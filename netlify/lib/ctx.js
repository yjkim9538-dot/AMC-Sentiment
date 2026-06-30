// Netlify Functions 공용 env 어댑터 — Cloudflare 핸들러의 env 객체와 같은 모양으로 맞춤.
// DB 는 Netlify Blobs 사이트 스코프 스토어, 비밀값은 Netlify 환경변수에서 읽음.
import { getStore } from '@netlify/blobs';

function envGet(k) {
  if (typeof Netlify !== 'undefined' && Netlify.env && typeof Netlify.env.get === 'function') {
    return Netlify.env.get(k) || '';
  }
  return (typeof process !== 'undefined' && process.env && process.env[k]) || '';
}

export function getEnv() {
  return {
    DB: getStore('amc-consensus'),
    APP_PASSWORD: envGet('APP_PASSWORD'),
    AUTH_SECRET: envGet('AUTH_SECRET'),
    ANTHROPIC_API_KEY: envGet('ANTHROPIC_API_KEY'),
    ANTHROPIC_MODEL: envGet('ANTHROPIC_MODEL'),
  };
}
