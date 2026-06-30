// 비밀번호 로그인 — Web Crypto(crypto.subtle) 기반. Netlify Functions(Node18+)·Edge(Deno) 모두 호환.
// 환경변수: APP_PASSWORD(설정 시 보호 활성), AUTH_SECRET(쿠키 서명용).

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function authEnabled(env) {
  return !!(env && env.APP_PASSWORD);
}

export async function authToken(env) {
  return sha256hex('amc|' + (env.APP_PASSWORD || '') + '|' + (env.AUTH_SECRET || 'amc-default-secret'));
}

export async function isAuthed(request, env) {
  if (!authEnabled(env)) return true;
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)amc_auth=([a-f0-9]+)/);
  if (!m) return false;
  return m[1] === (await authToken(env));
}

export function cookieHeader(token, maxAge) {
  return `amc_auth=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
