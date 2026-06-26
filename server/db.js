// SQLite 데이터 저장소 (node:sqlite — 내장, 네이티브 컴파일 불필요)
// 제출 회차(분기/월)별로 운용사 컨센서스를 누적 저장한다.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, 'consensus.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    period      TEXT NOT NULL,          -- 제출 회차, 예: "2026 2Q"
    amc         TEXT NOT NULL,          -- 운용사명
    data        TEXT NOT NULL,          -- JSON: { domesticMarket, domesticStocks[], overseas[] }
    created_at  TEXT NOT NULL,
    UNIQUE(period, amc)
  );
  CREATE INDEX IF NOT EXISTS idx_submissions_period ON submissions(period);
`);

// 한 운용사의 한 회차 제출을 저장(있으면 갱신).
const upsertStmt = db.prepare(`
  INSERT INTO submissions (period, amc, data, created_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(period, amc) DO UPDATE SET data = excluded.data, created_at = excluded.created_at
`);

export function upsertSubmission(period, amc, data, createdAt) {
  upsertStmt.run(period, amc, JSON.stringify(data), createdAt);
}

// 회차 목록 + 회차별 응답 운용사 수
export function listPeriods() {
  return db
    .prepare(`SELECT period, COUNT(*) AS amcCount, MAX(created_at) AS updatedAt
              FROM submissions GROUP BY period ORDER BY period DESC`)
    .all();
}

// 한 회차의 모든 제출을 정규화된 컨센서스 형태로 합쳐서 반환
export function getConsensus(period) {
  const rows = db
    .prepare(`SELECT amc, data, created_at FROM submissions WHERE period = ? ORDER BY amc`)
    .all(period);

  const domesticMarket = [];
  const domesticStocks = [];
  const overseas = [];

  for (const row of rows) {
    const d = JSON.parse(row.data);
    if (d.domesticMarket) domesticMarket.push({ amc: row.amc, ...d.domesticMarket });
    for (const s of d.domesticStocks || []) domesticStocks.push({ amc: row.amc, ...s });
    for (const o of d.overseas || []) overseas.push({ amc: row.amc, ...o });
  }
  return { period, domesticMarket, domesticStocks, overseas };
}

// 전 회차에 걸친 모든 데이터(챗봇 컨텍스트용)
export function getAllForContext() {
  const rows = db.prepare(`SELECT period, amc, data FROM submissions ORDER BY period DESC, amc`).all();
  return rows.map((r) => ({ period: r.period, amc: r.amc, ...JSON.parse(r.data) }));
}

// 회차별 국내·해외 방향성 분포 추이
export function getTrend() {
  const periods = db.prepare(`SELECT DISTINCT period FROM submissions ORDER BY period`).all();
  return periods.map(({ period }) => {
    const c = getConsensus(period);
    const dom = { 강세: 0, 중립: 0, 약세: 0 };
    c.domesticMarket.forEach((r) => { if (dom[r.view] !== undefined) dom[r.view]++; });
    const ovs = { 강세: 0, 중립: 0, 약세: 0 };
    c.overseas.forEach((r) => { if (ovs[r.view] !== undefined) ovs[r.view]++; });
    return { period, amcCount: c.domesticMarket.length, domestic: dom, overseas: ovs };
  });
}

export function countRows() {
  return db.prepare(`SELECT COUNT(*) AS n FROM submissions`).get().n;
}

export default db;
