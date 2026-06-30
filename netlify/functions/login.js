import { getEnv } from '../lib/ctx.js';
import { authEnabled, authToken, cookieHeader } from '../lib/auth.js';

export default async (request) => {
  const env = getEnv();
  if (!authEnabled(env)) return Response.json({ ok: true });
  const { password } = await request.json().catch(() => ({}));
  if (password === env.APP_PASSWORD) {
    const tok = await authToken(env);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'Set-Cookie': cookieHeader(tok, 7 * 24 * 3600) },
    });
  }
  return Response.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
};

export const config = { path: '/api/login', method: ['POST'] };
