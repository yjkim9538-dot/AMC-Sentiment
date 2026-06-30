// SQLite 데이터 저장소 (node:sqlite — 내장, 네이티브 컴파일 불필요)
// 제출 회차별로 운용사 컨센서스를 누적 저장한다.
// 저장은 append-only(버전 이력 보존): 같은 (회차, 운용사) 재업로드 시에도 과거 행을 지우지 않고
// 새 행을 추가한다. 대시보드/집계는 (회차, 운용사)별 "가장 최근" 행만 사용한다.
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
    period      TEXT NOT NULL,          -- 제출 회차, 예: "2026-06-26"
    amc         TEXT NOT NULL,          -- 운용사명
    data        TEXT NOT NULL,          -- JSON: { domesticMarket, domesticStocks[], overseas[] }
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_submissions_period ON submissions(period);
  CREATE INDEX IF NOT EXISTS idx_submissions_pa ON submissions(period, amc);
`);

// --- 마이그레이션: 구버전 스키마(UNIQUE(period, amc))를 append-only 로 전환 ---
// 구버전은 재업로드 시 덮어써서 과거 이력이 사라졌다. UNIQUE 제약을 제거해 이력을 보존한다.
(function migrate() {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='submissions'`)
    .get();
  if (row && /UNIQUE/i.test(row.sql)) {
    try {
      db.exec('BEGIN');
      db.exec('ALTER TABLE submissions RENAME TO submissions_old');
      db.exec(`
        CREATE TABLE submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          period TEXT NOT NULL, amc TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL
        );
      `);
      db.exec(`INSERT INTO submissions (period, amc, data, created_at)
               SELECT period, amc, data, created_at FROM submissions_old`);
      db.exec('DROP TABLE submissions_old');
      db.exec('CREATE INDEX IF NOT EXISTS idx_submissions_period ON submissions(period)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_submissions_pa ON submissions(period, amc)');
      db.exec('COMMIT');
      console.log('[db] 스키마 마이그레이션 완료: append-only(이력 보존)로 전환');
    } catch (e) {
      db.exec('ROLLBACK');
      console.error('[db] 마이그레이션 실패:', e);
    }
  }
})();

// 한 운용사의 한 회차 제출을 저장(append-only: 항상 새 행 추가).
// 반환: 직전에 같은 (회차, 운용사) 제출이 있었는지 여부(신규/갱신 구분용).
const existsStmt = db.prepare(`SELECT 1 FROM submissions WHERE period = ? AND amc = ? LIMIT 1`);
const insertStmt = db.prepare(
  `INSERT INTO submissions (period, amc, data, created_at) VALUES (?, ?, ?, ?)`
);

export function saveSubmission(period, amc, data, createdAt) {
  const existed = !!existsStmt.get(period, amc);
  insertStmt.run(period, amc, JSON.stringify(data), createdAt);
  return existed ? 'updated' : 'new';
}

// (회차, 운용사)별 최신 행 id 집합을 구하는 서브쿼리
const LATEST_IDS = `SELECT MAX(id) AS id FROM submissions GROUP BY period, amc`;

// 회차 목록 + 회차별 응답 운용사 수(최신 기준)
export function listPeriods() {
  return db
    .prepare(`
      SELECT period, COUNT(*) AS amcCount, MAX(created_at) AS updatedAt
      FROM submissions WHERE id IN (${LATEST_IDS})
      GROUP BY period ORDER BY period DESC
    `)
    .all();
}

// 한 회차의 통합 컨센서스(운용사별 최신 제출만)
export function getConsensus(period) {
  const rows = db
    .prepare(`
      SELECT amc, data, created_at FROM submissions
      WHERE period = ? AND id IN (${LATEST_IDS})
      ORDER BY amc
    `)
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

// 전 회차 데이터(챗봇 컨텍스트) — (회차, 운용사)별 최신만. 과거 회차 전체 포함.
export function getAllForContext() {
  const rows = db
    .prepare(`
      SELECT period, amc, data FROM submissions
      WHERE id IN (${LATEST_IDS})
      ORDER BY period DESC, amc
    `)
    .all();
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

// 전체 행 수(이력 포함) / 최신 기준 운용사·회차 수
export function countRows() {
  return db.prepare(`SELECT COUNT(*) AS n FROM submissions`).get().n;
}

export default db;
