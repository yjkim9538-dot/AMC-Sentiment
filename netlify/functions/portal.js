// 운용사 업로드 포털 API — 비밀 링크 토큰이 곧 인증. 쿠키 로그인 없이 접근(엣지 게이트 공개 경로).
// GET  /api/portal?token=...  → 본인 운용사명·접수 회차·본인 제출 이력만 반환
// POST /api/portal {token, data} → 저장. 운용사명은 서버가 토큰에서 강제(파일 내용의 운용사명은 무시).
import { getEnv } from '../lib/ctx.js';
import { saveSubmission, getAmcHistory } from '../lib/db.js';
import { findAmcByToken, getSettings } from '../lib/links.js';

// 접수 회차 미설정 시 대체값 — 업로드 당일 날짜(KST)
function kstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export default async (request) => {
  const env = getEnv();
  const store = env.DB;

  if (request.method === 'GET') {
    const token = new URL(request.url).searchParams.get('token') || '';
    const amc = await findAmcByToken(store, token);
    if (!amc) {
      return Response.json({ error: '유효하지 않은 업로드 링크입니다. 군인공제회 담당자에게 링크를 다시 요청해 주세요.' }, { status: 403 });
    }
    const settings = await getSettings(store);
    return Response.json({
      amc,
      activePeriod: settings.activePeriod || '',
      submissions: await getAmcHistory(store, amc),
    });
  }

  const body = await request.json().catch(() => ({}));
  const amc = await findAmcByToken(store, String(body.token || ''));
  if (!amc) {
    return Response.json({ error: '유효하지 않은 업로드 링크입니다. 군인공제회 담당자에게 링크를 다시 요청해 주세요.' }, { status: 403 });
  }

  const d = body.data || {};
  const data = {
    domesticMarket: d.domesticMarket || null,
    domesticStocks: Array.isArray(d.domesticStocks) ? d.domesticStocks : [],
    overseas: Array.isArray(d.overseas) ? d.overseas : [],
  };
  if (!data.domesticMarket && !data.domesticStocks.length && !data.overseas.length) {
    return Response.json({ error: '인식된 데이터가 없습니다. 양식(국내시장/국내종목/해외 시트)을 확인해 주세요.' }, { status: 400 });
  }

  const settings = await getSettings(store);
  const period = settings.activePeriod || kstToday();
  const status = await saveSubmission(store, period, amc, data, new Date().toISOString());
  return Response.json({ ok: true, amc, period, status });
};

export const config = { path: '/api/portal', method: ['GET', 'POST'] };
