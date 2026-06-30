import { saveSubmission } from '../../lib/db.js';

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}));
  const { period, submissions } = body;
  if (!period || !Array.isArray(submissions) || submissions.length === 0) {
    return Response.json({ error: 'period 와 submissions 배열이 필요합니다.' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const results = [];
  for (const s of submissions) {
    if (!s.amc) continue;
    const status = await saveSubmission(
      env.DB,
      period,
      s.amc,
      {
        domesticMarket: s.domesticMarket || null,
        domesticStocks: s.domesticStocks || [],
        overseas: s.overseas || [],
      },
      now
    );
    results.push({ amc: s.amc, status });
  }
  return Response.json({ ok: true, period, saved: results.length, results });
}
