// SMTP 发信：465 端口 + SSL 隐式 TLS（非 STARTTLS），基于 cloudflare:sockets
import { connect } from 'cloudflare:sockets';
import { esc } from './kv.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64utf8(s) {
  return btoa(unescape(encodeURIComponent(s)));
}

/** base64 按 76 字符折行（符合 RFC 2045） */
function b64lines(s) {
  return b64utf8(s).replace(/.{1,76}/g, '$&\r\n').trim();
}

/** DATA 阶段点号转义 */
function dotStuff(body) {
  return body
    .split('\r\n')
    .map(l => (l.startsWith('.') ? '.' + l : l))
    .join('\r\n');
}

/**
 * 发送邮件
 * @param {object} env Worker env（SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM）
 * @param {{to:string[], subject:string, html:string, text:string}} mail
 */
export async function sendMail(env, mail) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error('SMTP 未配置（SMTP_HOST/SMTP_USER/SMTP_PASS）');
  }
  const host = env.SMTP_HOST;
  const port = Number(env.SMTP_PORT || 465);
  const socket = connect({ hostname: host, port }, { secureTransport: 'on' });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  let buffer = '';

  async function readReply() {
    while (true) {
      const idx = buffer.lastIndexOf('\r\n');
      if (idx >= 0) {
        const lines = buffer.slice(0, idx).split('\r\n');
        const last = lines[lines.length - 1];
        // SMTP 多行响应以 "NNN "（数字+空格）结尾
        if (/^\d{3} /.test(last)) {
          const code = parseInt(last.slice(0, 3), 10);
          const text = buffer.slice(0, idx + 2);
          buffer = buffer.slice(idx + 2);
          return { code, text };
        }
      }
      const { value, done } = await reader.read();
      if (done) return { code: 0, text: buffer };
      buffer += dec.decode(value, { stream: true });
    }
  }

  async function cmd(c, expect) {
    await writer.write(enc.encode(c + '\r\n'));
    const r = await readReply();
    if (expect && !expect.includes(r.code)) {
      throw new Error(`SMTP "${c.split(' ')[0]}" failed: ${r.code} ${r.text.trim()}`);
    }
    return r;
  }

  try {
    const greet = await readReply();
    if (greet.code !== 220) throw new Error('SMTP greet failed: ' + greet.text.trim());

    const fromMatch = env.MAIL_FROM.match(/<([^>]+)>/);
    const from = fromMatch ? fromMatch[1] : env.MAIL_FROM.trim();
    const fromName = env.MAIL_FROM.replace(/<[^>]+>/, '').trim() || 'AB Store';
    const domain = (from.split('@')[1]) || 'localhost';

    await cmd('EHLO ' + domain, [250]);
    // 若 SMTP_USER 含完整邮箱则直接用，否则按 username@domain 处理
    const smtpUser = env.SMTP_USER.includes('@') ? env.SMTP_USER : env.SMTP_USER;
    await cmd('AUTH LOGIN', [334]);
    await cmd(btoa(smtpUser), [334]);
    await cmd(btoa(env.SMTP_PASS), [235]);

    await cmd(`MAIL FROM:<${from}>`, [250]);
    for (const rcpt of mail.to) {
      await cmd(`RCPT TO:<${rcpt}>`, [250, 251]);
    }
    await cmd('DATA', [354]);

    const boundary = '----abs_' + crypto.randomUUID().replace(/-/g, '');
    const data =
      [
        `From: =?UTF-8?B?${b64utf8(fromName)}?= <${from}>`,
        `To: ${mail.to.join(', ')}`,
        `Subject: =?UTF-8?B?${b64utf8(mail.subject)}?=`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        b64lines(mail.text),
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        b64lines(mail.html),
        `--${boundary}--`,
        '',
      ].join('\r\n');

    await writer.write(enc.encode(dotStuff(data) + '\r\n.\r\n'));
    const r = await readReply();
    if (r.code !== 250) throw new Error('SMTP DATA failed: ' + r.text.trim());
    await cmd('QUIT', [221]);
  } finally {
    try { writer.releaseLock(); } catch {}
    try { reader.releaseLock(); } catch {}
    try { socket.close(); } catch {}
  }
}

/** MD3 配色邮件模板（主题色 #4682B4；调用方负责转义用户输入） */
export function mailTemplate(title, innerHtml) {
  return (
    '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:24px;background:#F8FAFE;font-family:system-ui,-apple-system,sans-serif">' +
    '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #C2C7CF">' +
    '<div style="font-size:20px;font-weight:700;color:#4682B4;margin-bottom:4px">AB Store</div>' +
    '<div style="font-size:16px;font-weight:600;color:#191C1F;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #E1E5EC">' + esc(title) + '</div>' +
    '<div style="font-size:14px;color:#42474E;line-height:1.7">' + innerHtml + '</div>' +
    '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #E1E5EC;font-size:12px;color:#72787F">本邮件由 AB Store（ab-store.lhl.one）自动发送，请勿直接回复。如非本人操作请忽略。</div>' +
    '</div></body></html>'
  );
}
