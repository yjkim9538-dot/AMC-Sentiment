// 모든 요청에 대한 인증 게이트 (Cloudflare Pages 미들웨어)
import { isAuthed } from '../lib/auth.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const path = new URL(request.url).pathname;

  // 로그인/로그아웃과 로그인 페이지는 통과
  if (path === '/login.html' || path === '/api/login' || path === '/api/logout') return next();

  if (await isAuthed(request, env)) return next();

  // 미인증: API 는 401, 그 외(화면)는 로그인 페이지로
  if (path.startsWith('/api/')) {
    return Response.json({ error: '인증이 필요합니다.', login: true }, { status: 401 });
  }
  return Response.redirect(new URL('/login.html', request.url).toString(), 302);
}
