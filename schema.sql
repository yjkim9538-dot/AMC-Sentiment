-- Cloudflare D1 스키마 (append-only 이력 보존)
CREATE TABLE IF NOT EXISTS submissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  period      TEXT NOT NULL,
  amc         TEXT NOT NULL,
  data        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_submissions_period ON submissions(period);
CREATE INDEX IF NOT EXISTS idx_submissions_pa ON submissions(period, amc);
