// 인증 게이트 (Netlify Edge Function) — Cloudflare functions/_middleware.js 미러.
// APP_PASSWORD 미설정 시 보호 비활성(전부 통과). 설정 시 쿠키 검증.
import { isAuthed } from '../lib/auth.js';

export default async (request, context) => {
  const path = new URL(request.url).pathname;

  // 로그인/로그아웃과 로그인 페이지는 통과
  if (path === '/login.html' || path === '/api/login' || path === '/api/logout') return;

  const env = {
    APP_PASSWORD: (typeof Netlify !== 'undefined' && Netlify.env.get('APP_PASSWORD')) || '',
    AUTH_SECRET: (typeof Netlify !== 'undefined' && Netlify.env.get('AUTH_SECRET')) || '',
  };

  if (await isAuthed(request, env)) return; // 통과 → 정적/함수로 진행

  // 미인증: API 는 401, 그 외(화면)는 로그인 페이지로
  if (path.startsWith('/api/')) {
    return Response.json({ error: '인증이 필요합니다.', login: true }, { status: 401 });
  }
  return Response.redirect(new URL('/login.html', request.url).toString(), 302);
};

export const config = { path: '/*' };
