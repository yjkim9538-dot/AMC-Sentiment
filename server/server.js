// AMC 증시 컨센서스 대시보드 — 백엔드 서버
// 정적 프론트엔드 서빙 + 데이터 저장소(SQLite) API + AI 챗봇 API
import './env.js'; // ⚠️ 최상단: .env 를 chat.js 보다 먼저 로드
import express from 'express';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  saveSubmission,
  listPeriods,
  getConsensus,
  getTrend,
  countRows,
} from './db.js';
import { askChat, chatAvailable } from './chat.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

// ---------- 비밀번호 로그인(접근 제어) ----------
// APP_PASSWORD 가 설정돼 있으면 모든 화면/ API 를 비밀번호로 보호한다(미설정 시 게이트 비활성).
const PASSWORD = process.env.APP_PASSWORD || '';
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(24).toString('hex');
const authEnabled = !!PASSWORD;
function authToken() {
  return crypto.createHash('sha256').update('amc|' + PASSWORD + '|' + AUTH_SECRET).digest('hex');
}
function isAuthed(req) {
  if (!authEnabled) return true;
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)amc_auth=([a-f0-9]+)/);
  return !!m && m[1] === authToken();
}

const app = express();
app.use(express.json({ limit: '20mb' }));

// 로그인 라우트(게이트 이전에 정의)
app.post('/api/login', (req, res) => {
  if (!authEnabled) return res.json({ ok: true });
  if ((req.body && req.body.password) === PASSWORD) {
    res.setHeader(
      'Set-Cookie',
      `amc_auth=${authToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`
    );
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
});
app.post('/api/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'amc_auth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// 인증 게이트 — 미인증이면 로그인 페이지(또는 API 401)
app.use((req, res, next) => {
  if (isAuthed(req)) return next();
  if (req.path === '/login.html') return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: '인증이 필요합니다.', login: true });
  return res.sendFile(join(PUBLIC_DIR, 'login.html'));
});

app.use(express.static(PUBLIC_DIR));

// 상태/기능 확인 (프론트가 백엔드 가용성·챗봇·인증 여부 판단)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rows: countRows(), chat: chatAvailable(), auth: authEnabled });
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
  const results = [];
  for (const s of submissions) {
    if (!s.amc) continue;
    const status = saveSubmission(
      period,
      s.amc,
      {
        domesticMarket: s.domesticMarket || null,
        domesticStocks: s.domesticStocks || [],
        overseas: s.overseas || [],
      },
      now
    );
    results.push({ amc: s.amc, status }); // status: 'new' | 'updated'
  }
  res.json({ ok: true, period, saved: results.length, results });
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
  console.log(`  - 로그인 보호: ${authEnabled ? '활성 (APP_PASSWORD 설정됨)' : '비활성 (APP_PASSWORD 없음 — 누구나 접속)'}`);
});
