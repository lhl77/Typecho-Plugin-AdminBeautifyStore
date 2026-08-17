// WebDAV 上传（指向 OpenList WebDAV 入口，OpenList 侧挂载 GitHub share 分支）

function authHeader(env) {
  return 'Basic ' + btoa(`${env.WEBDAV_USER}:${env.WEBDAV_PASS}`);
}

/** 逐级创建目录（405/409 视为已存在） */
async function mkcol(env, base, dirPath) {
  const segs = dirPath.split('/').filter(Boolean);
  let cur = '';
  for (const s of segs) {
    cur += '/' + s;
    const res = await fetch(base + cur, {
      method: 'MKCOL',
      headers: { Authorization: authHeader(env) },
    });
    if (!res.ok && ![201, 204, 301, 405, 409].includes(res.status)) {
      throw new Error(`WebDAV MKCOL ${cur} failed: ${res.status}`);
    }
  }
}

/**
 * 上传文件到 WebDAV
 * @param env Worker env
 * @param path 相对存储路径，如 <dir>/<username>/<pluginId>/<file>.zip
 * @param data ArrayBuffer / Uint8Array
 * @returns 实际存储的相对路径
 */
export async function webdavPut(env, path, data) {
  if (!env.WEBDAV_BASE) throw new Error('WEBDAV_BASE 未配置');
  const base = env.WEBDAV_BASE.replace(/\/+$/, '');
  const clean = path.split('/').filter(Boolean).join('/');
  const dir = clean.split('/').slice(0, -1).join('/');
  if (dir) await mkcol(env, base, dir);
  const res = await fetch(base + '/' + clean, {
    method: 'PUT',
    headers: {
      Authorization: authHeader(env),
      'Content-Type': 'application/zip',
    },
    body: data,
  });
  if (!res.ok && ![201, 204].includes(res.status)) {
    throw new Error(`WebDAV PUT failed: ${res.status}`);
  }
  return clean;
}

/** 拼接 gh1.lhl.one 下载直链 */
export function buildDownloadUrl(env, path) {
  const gh = String(env.GH1_BASE || 'https://gh1.lhl.one').replace(/\/+$/, '');
  return `${gh}/https://raw.githubusercontent.com/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/${path}`;
}
