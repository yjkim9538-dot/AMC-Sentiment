// 인증 게이트 (Netlify Edge Function)
// - 대시보드(/, /index.html)와 관리자 API 는 APP_PASSWORD 쿠키 로그인 필요
// - 운용사 비밀 업로드 링크(/u/<token>)와 포털 API(/api/portal)는 토큰 자체가 인증이므로 공개
// - 정적 자산(css/js/양식)은 업로드 페이지가 로그인 없이도 로드해야 하므로 공개(민감정보 없음)
// APP_PASSWORD 미설정 시 보호 비활성(전부 통과).
import { isAuthed } from '../lib/auth.js';

const OPEN_PATHS = ['/login.html', '/upload.html', '/api/login', '/api/logout', '/api/portal'];
const OPEN_PREFIXES = ['/css/', '/js/', '/lib/', '/templates/', '/favicon'];

export default async (request, context) => {
  const path = new URL(request.url).pathname;

  // 운용사 비밀 업로드 링크 → 업로드 페이지로 리라이트(토큰은 페이지 JS 가 경로에서 읽음)
  // URL 반환 = 같은 사이트 내 리라이트(200) — Netlify Edge Functions 표준 문법
  if (path.startsWith('/u/')) return new URL('/upload.html', request.url);

  if (OPEN_PATHS.includes(path) || OPEN_PREFIXES.some((p) => path.startsWith(p))) return;

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
