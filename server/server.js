// AMC 증시 컨센서스 대시보드 — 백엔드 서버
// 정적 프론트엔드 서빙 + 데이터 저장소(SQLite) API + AI 챗봇 API
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  upsertSubmission,
  listPeriods,
  getConsensus,
  getTrend,
  countRows,
} from './db.js';
import { askChat, chatAvailable } from './chat.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(PUBLIC_DIR));

// 상태/기능 확인 (프론트가 백엔드 가용성·챗봇 가용성 판단)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rows: countRows(), chat: chatAvailable() });
});

// 회차 목록
app.get('/api/periods', (_req, res) => {
  res.json({ periods: listPeriods() });
});

// 특정 회차의 통합 컨센서스
app.get('/api/consensus', (req, res) => {
  const period = String(req.query.period || '').trim();
  if (!period) return res.status(400).json({ error: 'period 파라미터가 필요합니다.' });
  res.json(getConsensus(period));
});

// 회차별 방향성 추이
app.get('/api/trend', (_req, res) => {
  res.json({ trend: getTrend() });
});

// 제출 저장 — 프론트가 엑셀을 파싱해 운용사별로 묶어 전송한다.
// body: { period, submissions: [{ amc, domesticMarket, domesticStocks, overseas }] }
app.post('/api/submissions', (req, res) => {
  const { period, submissions } = req.body || {};
  if (!period || !Array.isArray(submissions) || submissions.length === 0) {
    return res.status(400).json({ error: 'period 와 submissions 배열이 필요합니다.' });
  }
  const now = new Date().toISOString();
  let saved = 0;
  for (const s of submissions) {
    if (!s.amc) continue;
    upsertSubmission(
      period,
      s.amc,
      {
        domesticMarket: s.domesticMarket || null,
        domesticStocks: s.domesticStocks || [],
        overseas: s.overseas || [],
      },
      now
    );
    saved += 1;
  }
  res.json({ ok: true, period, saved });
});

// AI 챗봇 — body: { question, history?: [{q, a}] }
app.post('/api/chat', async (req, res) => {
  const { question, history } = req.body || {};
  if (!question || !String(question).trim()) {
    return res.status(400).json({ error: 'question 이 필요합니다.' });
  }
  try {
    const result = await askChat(String(question).trim(), Array.isArray(history) ? history : []);
    res.json(result);
  } catch (err) {
    console.error('chat error:', err);
    res.status(500).json({ error: 'AI 응답 생성 중 오류가 발생했습니다.', detail: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`AMC 컨센서스 서버 실행 중: http://localhost:${PORT}`);
  console.log(`  - 저장된 제출 건수: ${countRows()}`);
  console.log(`  - AI 챗봇: ${chatAvailable() ? '사용 가능 (ANTHROPIC_API_KEY 감지됨)' : '비활성 (ANTHROPIC_API_KEY 없음)'}`);
});
