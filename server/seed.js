// 샘플 데이터로 DB를 초기화한다(데모용). 두 개 회차(2026 1Q, 2026 2Q)를 넣어 추이를 보여준다.
// 실행: npm run seed
import { upsertSubmission, countRows } from './db.js';

const INDEX = { 미국: 'S&P500', 일본: 'Nikkei225', 베트남: 'VN-Index', 인도: 'Nifty50', ACWI: 'MSCI ACWI', 선진국: 'MSCI World' };
const BAND = { 미국: [5300, 6000], 일본: [37000, 42000], 베트남: [1150, 1400], 인도: [22500, 27000], ACWI: [780, 900], 선진국: [3400, 3900] };

function ovs(_amc, views) {
  return Object.keys(views).map((market) => ({
    asOf: '2026-06-20', market, index: INDEX[market], view: views[market],
    targetLow: BAND[market][0], targetHigh: BAND[market][1],
    pro: '글로벌 이익 모멘텀 개선 기대.', con: '지정학·금리 변동성 리스크.',
  }));
}

// 2026 2Q 기준 운용사별 제출(운용사당: 국내시장 1 + 국내종목 2~3 + 해외 6시장)
const Q2 = [
  {
    amc: '미래에셋자산운용',
    domesticMarket: { asOf: '2026-06-20', view: '강세', targetLow: 2750, targetHigh: 3050,
      pro: '반도체 업황 회복과 수출 개선, 외국인 순매수 전환. 밸류업 주주환원 확대 기대.',
      con: '미국 금리 인하 지연 가능성, 중국 경기 둔화 리스크.' },
    domesticStocks: [
      { stock: '삼성전자', opinion: '매수', reason: 'HBM 경쟁력 회복, 파운드리 수주 확대 기대.' },
      { stock: 'SK하이닉스', opinion: '매수', reason: 'HBM 시장 선두, AI 수요 수혜 지속.' },
      { stock: 'LG에너지솔루션', opinion: '중립', reason: '전기차 둔화, ESS 성장 기대.' },
    ],
    overseas: ovs('미래에셋', { 미국: '강세', 일본: '강세', 베트남: '중립', 인도: '강세', ACWI: '강세', 선진국: '강세' }),
  },
  {
    amc: '삼성자산운용',
    domesticMarket: { asOf: '2026-06-19', view: '중립', targetLow: 2650, targetHigh: 2900,
      pro: '기업 실적 바닥 통과, AI 관련 IT 수요 견조. 저평가 매력.',
      con: '지정학 불확실성과 환율 변동성. 내수 부진 지속.' },
    domesticStocks: [
      { stock: '삼성전자', opinion: '매수', reason: '밸류에이션 매력과 주주환원 강화.' },
      { stock: '현대차', opinion: '매수', reason: '하이브리드 판매 호조와 견조한 마진.' },
      { stock: 'NAVER', opinion: '중립', reason: '광고 회복 더디나 AI 신사업 기대.' },
    ],
    overseas: ovs('삼성', { 미국: '중립', 일본: '강세', 베트남: '중립', 인도: '중립', ACWI: '중립', 선진국: '중립' }),
  },
  {
    amc: 'KB자산운용',
    domesticMarket: { asOf: '2026-06-21', view: '강세', targetLow: 2800, targetHigh: 3100,
      pro: '금리 인하 사이클 진입 기대, 반도체·2차전지 모멘텀 회복.',
      con: '미 대선 이후 통상정책 불확실성, 단기 과열 부담.' },
    domesticStocks: [
      { stock: 'SK하이닉스', opinion: '매수', reason: 'HBM3E 양산 본격화, 실적 레버리지 확대.' },
      { stock: '삼성전자', opinion: '매수', reason: '메모리 가격 상승 사이클 진입.' },
      { stock: 'POSCO홀딩스', opinion: '매도', reason: '철강 업황 부진과 2차전지 소재 수익성 악화.' },
    ],
    overseas: ovs('KB', { 미국: '강세', 일본: '중립', 베트남: '강세', 인도: '강세', ACWI: '강세', 선진국: '강세' }),
  },
  {
    amc: '한국투자신탁운용',
    domesticMarket: { asOf: '2026-06-18', view: '약세', targetLow: 2500, targetHigh: 2780,
      pro: '낮은 밸류에이션, 배당 확대 정책.',
      con: '글로벌 경기 둔화와 수출 감소, 부동산 PF 리스크. 외국인 자금 이탈 우려.' },
    domesticStocks: [
      { stock: '현대차', opinion: '매수', reason: '저평가 + 고배당 매력.' },
      { stock: 'LG에너지솔루션', opinion: '매도', reason: '전방 수요 둔화와 경쟁 심화로 마진 압박.' },
      { stock: 'KB금융', opinion: '매수', reason: '밸류업 수혜와 안정적 배당.' },
    ],
    overseas: ovs('한국투자', { 미국: '중립', 일본: '중립', 베트남: '약세', 인도: '중립', ACWI: '약세', 선진국: '중립' }),
  },
  {
    amc: '신한자산운용',
    domesticMarket: { asOf: '2026-06-20', view: '중립', targetLow: 2620, targetHigh: 2950,
      pro: '실적 개선 흐름과 밸류업 정책 수혜.',
      con: '금리·환율 변동성, 반도체 외 업종 부진.' },
    domesticStocks: [
      { stock: '삼성전자', opinion: '중립', reason: '업황 회복은 긍정적이나 주가 선반영.' },
      { stock: 'KB금융', opinion: '매수', reason: '금융주 밸류업 정책 핵심 수혜.' },
      { stock: 'NAVER', opinion: '매수', reason: '커머스·AI 모멘텀 회복 기대.' },
    ],
    overseas: ovs('신한', { 미국: '강세', 일본: '강세', 베트남: '중립', 인도: '강세', ACWI: '중립', 선진국: '강세' }),
  },
];

// 1Q 는 2Q 대비 한 단계 보수적으로 만들어 추이를 보여준다.
const DOWN = { 강세: '중립', 중립: '약세', 약세: '약세' };
const DOWN_OP = { 매수: '중립', 중립: '매도', 매도: '매도' };
function downgrade(sub) {
  return {
    amc: sub.amc,
    domesticMarket: { ...sub.domesticMarket, asOf: '2026-03-20', view: DOWN[sub.domesticMarket.view],
      targetLow: sub.domesticMarket.targetLow - 150, targetHigh: sub.domesticMarket.targetHigh - 150 },
    domesticStocks: sub.domesticStocks.map((s) => ({ ...s, opinion: DOWN_OP[s.opinion] })),
    overseas: sub.overseas.map((o) => ({ ...o, asOf: '2026-03-20', view: DOWN[o.view] })),
  };
}

const NOW = new Date().toISOString();
for (const s of Q2.map(downgrade)) {
  upsertSubmission('2026 1Q', s.amc, { domesticMarket: s.domesticMarket, domesticStocks: s.domesticStocks, overseas: s.overseas }, NOW);
}
for (const s of Q2) {
  upsertSubmission('2026 2Q', s.amc, { domesticMarket: s.domesticMarket, domesticStocks: s.domesticStocks, overseas: s.overseas }, NOW);
}

console.log(`시드 완료. 총 제출 건수: ${countRows()} (2026 1Q, 2026 2Q)`);
