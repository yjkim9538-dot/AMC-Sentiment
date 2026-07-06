// Cloudflare D1(SQLite) 쿼리 — Pages Functions 에서 사용 (env.DB 바인딩)
// append-only(이력 보존): 집계는 (회차, 운용사)별 최신 행만 사용.
const LATEST_IDS = `SELECT MAX(id) AS id FROM submissions GROUP BY period, amc`;

export async function listPeriods(db) {
  const { results } = await db
    .prepare(`SELECT period, COUNT(*) AS amcCount, MAX(created_at) AS updatedAt
              FROM submissions WHERE id IN (${LATEST_IDS})
              GROUP BY period ORDER BY period DESC`)
    .all();
  return results || [];
}

// 운용사별 전체 기간 최신 행(회차 무관)
const LATEST_PER_AMC = `SELECT MAX(id) AS id FROM submissions GROUP BY amc`;

// period === '__all__' 이면 전체 기간 종합 — 같은 운용사는 가장 최근 제출만 반영.
export async function getConsensus(db, period) {
  const combined = period === '__all__';
  const stmt = combined
    ? db.prepare(`SELECT period, amc, data, created_at FROM submissions
                  WHERE id IN (${LATEST_PER_AMC}) ORDER BY amc`)
    : db.prepare(`SELECT period, amc, data, created_at FROM submissions
                  WHERE period = ? AND id IN (${LATEST_IDS}) ORDER BY amc`).bind(period);
  const { results } = await stmt.all();
  const domesticMarket = [], domesticStocks = [], overseas = [];
  for (const row of results || []) {
    const d = JSON.parse(row.data);
    if (d.domesticMarket) domesticMarket.push({ amc: row.amc, period: row.period, ...d.domesticMarket });
    for (const s of d.domesticStocks || []) domesticStocks.push({ amc: row.amc, period: row.period, ...s });
    for (const o of d.overseas || []) overseas.push({ amc: row.amc, period: row.period, ...o });
  }
  return { period, domesticMarket, domesticStocks, overseas };
}

export async function getAllForContext(db) {
  const { results } = await db
    .prepare(`SELECT period, amc, data FROM submissions WHERE id IN (${LATEST_IDS})
              ORDER BY period DESC, amc`)
    .all();
  return (results || []).map((r) => ({ period: r.period, amc: r.amc, ...JSON.parse(r.data) }));
}

export async function getTrend(db) {
  const { results } = await db.prepare(`SELECT DISTINCT period FROM submissions ORDER BY period`).all();
  const out = [];
  for (const { period } of results || []) {
    const c = await getConsensus(db, period);
    const dom = { 강세: 0, 중립: 0, 약세: 0 };
    c.domesticMarket.forEach((r) => { if (dom[r.view] !== undefined) dom[r.view]++; });
    const ovs = { 강세: 0, 중립: 0, 약세: 0 };
    c.overseas.forEach((r) => { if (ovs[r.view] !== undefined) ovs[r.view]++; });
    out.push({ period, amcCount: c.domesticMarket.length, domestic: dom, overseas: ovs });
  }
  return out;
}

export async function saveSubmission(db, period, amc, data, createdAt) {
  const existed = await db
    .prepare(`SELECT 1 FROM submissions WHERE period = ? AND amc = ? LIMIT 1`)
    .bind(period, amc)
    .first();
  await db
    .prepare(`INSERT INTO submissions (period, amc, data, created_at) VALUES (?, ?, ?, ?)`)
    .bind(period, amc, JSON.stringify(data), createdAt)
    .run();
  return existed ? 'updated' : 'new';
}

export async function countRows(db) {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM submissions`).first();
  return r ? r.n : 0;
}
