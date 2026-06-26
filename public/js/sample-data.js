/*
 * 샘플(Mock) 데이터
 * - 업로드 전에도 화면이 채워져 보이도록 기본 표시되는 가상 컨센서스입니다.
 * - 실제 데이터는 엑셀 업로드로 대체됩니다.
 * - 구조는 app.js 의 정규화 상태(state)와 동일합니다.
 */
window.SAMPLE_DATA = {
  meta: { source: '샘플 데이터', asOf: '2026-06-26' },

  // 국내 시장 전망 (운용사당 1건)
  domesticMarket: [
    {
      amc: '미래에셋자산운용', asOf: '2026-06-20', view: '강세',
      targetLow: 2750, targetHigh: 3050,
      pro: '반도체 업황 회복과 수출 개선, 외국인 순매수 전환. 밸류업 프로그램에 따른 주주환원 확대 기대.',
      con: '미국 금리 인하 지연 가능성, 중국 경기 둔화에 따른 수출 둔화 리스크.'
    },
    {
      amc: '삼성자산운용', asOf: '2026-06-19', view: '중립',
      targetLow: 2650, targetHigh: 2900,
      pro: '기업 실적 바닥 통과, AI 관련 IT 수요 견조. 저평가 매력.',
      con: '지정학적 불확실성과 환율 변동성 확대. 내수 부진 지속.'
    },
    {
      amc: 'KB자산운용', asOf: '2026-06-21', view: '강세',
      targetLow: 2800, targetHigh: 3100,
      pro: '금리 인하 사이클 진입 기대, 반도체·2차전지 모멘텀 회복.',
      con: '미 대선 이후 통상정책 불확실성, 단기 과열 부담.'
    },
    {
      amc: '한국투자신탁운용', asOf: '2026-06-18', view: '약세',
      targetLow: 2500, targetHigh: 2780,
      pro: '낮은 밸류에이션, 배당 확대 정책.',
      con: '글로벌 경기 둔화와 수출 감소, 부동산 PF 리스크 잔존. 외국인 자금 이탈 우려.'
    },
    {
      amc: '신한자산운용', asOf: '2026-06-20', view: '중립',
      targetLow: 2620, targetHigh: 2950,
      pro: '실적 개선 흐름과 밸류업 정책 수혜.',
      con: '금리·환율 변동성, 반도체 외 업종 부진.'
    }
  ],

  // 국내 종목 의견 (운용사 × 종목, 자율 선정)
  domesticStocks: [
    { amc: '미래에셋자산운용', stock: '삼성전자', opinion: '매수', reason: 'HBM 경쟁력 회복과 메모리 업황 반등. 파운드리 수주 확대 기대.' },
    { amc: '미래에셋자산운용', stock: 'SK하이닉스', opinion: '매수', reason: 'HBM 시장 선두, AI 수요 수혜 지속.' },
    { amc: '미래에셋자산운용', stock: 'LG에너지솔루션', opinion: '중립', reason: '전기차 수요 둔화, 그러나 ESS 부문 성장 기대.' },

    { amc: '삼성자산운용', stock: '삼성전자', opinion: '매수', reason: '밸류에이션 매력과 주주환원 강화.' },
    { amc: '삼성자산운용', stock: '현대차', opinion: '매수', reason: '하이브리드 판매 호조와 견조한 마진.' },
    { amc: '삼성자산운용', stock: 'NAVER', opinion: '중립', reason: '광고 회복 더디나 AI 신사업 기대.' },

    { amc: 'KB자산운용', stock: 'SK하이닉스', opinion: '매수', reason: 'HBM3E 양산 본격화, 실적 레버리지 확대.' },
    { amc: 'KB자산운용', stock: '삼성전자', opinion: '매수', reason: '메모리 가격 상승 사이클 진입.' },
    { amc: 'KB자산운용', stock: 'POSCO홀딩스', opinion: '매도', reason: '철강 업황 부진과 2차전지 소재 수익성 악화.' },

    { amc: '한국투자신탁운용', stock: '현대차', opinion: '매수', reason: '저평가 + 고배당 매력.' },
    { amc: '한국투자신탁운용', stock: 'LG에너지솔루션', opinion: '매도', reason: '전방 수요 둔화와 경쟁 심화로 마진 압박.' },
    { amc: '한국투자신탁운용', stock: 'KB금융', opinion: '매수', reason: '밸류업 수혜와 안정적 배당.' },

    { amc: '신한자산운용', stock: '삼성전자', opinion: '중립', reason: '업황 회복은 긍정적이나 주가 선반영.' },
    { amc: '신한자산운용', stock: 'KB금융', opinion: '매수', reason: '금융주 밸류업 정책 핵심 수혜.' },
    { amc: '신한자산운용', stock: 'NAVER', opinion: '매수', reason: '커머스·AI 모멘텀 회복 기대.' }
  ],

  // 해외 시장 전망 (운용사 × 시장)
  overseas: [
    // 미래에셋
    { amc: '미래에셋자산운용', asOf: '2026-06-20', market: '미국', index: 'S&P500', view: '강세', targetLow: 5400, targetHigh: 6000, pro: 'AI 투자 사이클 지속, 견조한 소비.', con: '밸류에이션 부담, 금리 변동성.' },
    { amc: '미래에셋자산운용', asOf: '2026-06-20', market: '일본', index: 'Nikkei225', view: '강세', targetLow: 38000, targetHigh: 43000, pro: '지배구조 개혁과 엔저 수혜.', con: 'BOJ 정책 정상화 속도.' },
    { amc: '미래에셋자산운용', asOf: '2026-06-20', market: '베트남', index: 'VN-Index', view: '중립', targetLow: 1200, targetHigh: 1400, pro: '제조업 이전 수혜, 내수 성장.', con: '환율·부동산 리스크.' },
    { amc: '미래에셋자산운용', asOf: '2026-06-20', market: '인도', index: 'Nifty50', view: '강세', targetLow: 23000, targetHigh: 27000, pro: '구조적 성장과 인프라 투자.', con: '높은 밸류에이션.' },
    { amc: '미래에셋자산운용', asOf: '2026-06-20', market: 'ACWI', index: 'MSCI ACWI', view: '강세', targetLow: 800, targetHigh: 900, pro: '글로벌 이익 모멘텀 개선.', con: '지정학 리스크.' },
    { amc: '미래에셋자산운용', asOf: '2026-06-20', market: '선진국', index: 'MSCI World', view: '강세', targetLow: 3500, targetHigh: 3900, pro: '미국 주도 성장.', con: '유럽 경기 부진.' },

    // 삼성
    { amc: '삼성자산운용', asOf: '2026-06-19', market: '미국', index: 'S&P500', view: '중립', targetLow: 5200, targetHigh: 5800, pro: '실적 견조, 기술주 주도.', con: '고평가와 집중도 위험.' },
    { amc: '삼성자산운용', asOf: '2026-06-19', market: '일본', index: 'Nikkei225', view: '강세', targetLow: 37500, targetHigh: 42000, pro: '기업 개혁과 자사주 매입.', con: '엔화 강세 전환 리스크.' },
    { amc: '삼성자산운용', asOf: '2026-06-19', market: '베트남', index: 'VN-Index', view: '중립', targetLow: 1180, targetHigh: 1350, pro: 'FDI 유입 지속.', con: '유동성 변동성.' },
    { amc: '삼성자산운용', asOf: '2026-06-19', market: '인도', index: 'Nifty50', view: '중립', targetLow: 22500, targetHigh: 25500, pro: '내수 성장.', con: '밸류에이션 부담과 유가 민감도.' },
    { amc: '삼성자산운용', asOf: '2026-06-19', market: 'ACWI', index: 'MSCI ACWI', view: '중립', targetLow: 780, targetHigh: 860, pro: '분산된 이익 성장.', con: '경기 둔화 가능성.' },
    { amc: '삼성자산운용', asOf: '2026-06-19', market: '선진국', index: 'MSCI World', view: '중립', targetLow: 3400, targetHigh: 3750, pro: '미국 견조.', con: '유럽·일본 혼조.' },

    // KB
    { amc: 'KB자산운용', asOf: '2026-06-21', market: '미국', index: 'S&P500', view: '강세', targetLow: 5500, targetHigh: 6100, pro: '금리 인하와 이익 성장.', con: '대선 정책 불확실성.' },
    { amc: 'KB자산운용', asOf: '2026-06-21', market: '일본', index: 'Nikkei225', view: '중립', targetLow: 37000, targetHigh: 41000, pro: '개혁 모멘텀.', con: '엔화 방향성 불확실.' },
    { amc: 'KB자산운용', asOf: '2026-06-21', market: '베트남', index: 'VN-Index', view: '강세', targetLow: 1250, targetHigh: 1450, pro: '신흥 제조 허브 부상.', con: '정책 리스크.' },
    { amc: 'KB자산운용', asOf: '2026-06-21', market: '인도', index: 'Nifty50', view: '강세', targetLow: 23500, targetHigh: 27500, pro: '인구·성장 구조.', con: '고밸류.' },
    { amc: 'KB자산운용', asOf: '2026-06-21', market: 'ACWI', index: 'MSCI ACWI', view: '강세', targetLow: 810, targetHigh: 910, pro: '글로벌 회복.', con: '변동성.' },
    { amc: 'KB자산운용', asOf: '2026-06-21', market: '선진국', index: 'MSCI World', view: '강세', targetLow: 3550, targetHigh: 3950, pro: '미국 주도.', con: '금리 경로.' },

    // 한국투자
    { amc: '한국투자신탁운용', asOf: '2026-06-18', market: '미국', index: 'S&P500', view: '중립', targetLow: 5100, targetHigh: 5700, pro: '실적 안정.', con: '밸류 부담과 침체 우려.' },
    { amc: '한국투자신탁운용', asOf: '2026-06-18', market: '일본', index: 'Nikkei225', view: '중립', targetLow: 36500, targetHigh: 40500, pro: '개혁 효과.', con: '엔 강세 리스크.' },
    { amc: '한국투자신탁운용', asOf: '2026-06-18', market: '베트남', index: 'VN-Index', view: '약세', targetLow: 1100, targetHigh: 1280, pro: '장기 성장.', con: '단기 유동성·환율 부담.' },
    { amc: '한국투자신탁운용', asOf: '2026-06-18', market: '인도', index: 'Nifty50', view: '중립', targetLow: 22000, targetHigh: 25000, pro: '성장성.', con: '밸류에이션 과열.' },
    { amc: '한국투자신탁운용', asOf: '2026-06-18', market: 'ACWI', index: 'MSCI ACWI', view: '약세', targetLow: 750, targetHigh: 830, pro: '저가 매력.', con: '경기 둔화.' },
    { amc: '한국투자신탁운용', asOf: '2026-06-18', market: '선진국', index: 'MSCI World', view: '중립', targetLow: 3350, targetHigh: 3700, pro: '미국 견조.', con: '유럽 부진.' },

    // 신한
    { amc: '신한자산운용', asOf: '2026-06-20', market: '미국', index: 'S&P500', view: '강세', targetLow: 5350, targetHigh: 5950, pro: 'AI·소비 견조.', con: '집중도 위험.' },
    { amc: '신한자산운용', asOf: '2026-06-20', market: '일본', index: 'Nikkei225', view: '강세', targetLow: 38000, targetHigh: 42500, pro: '구조 개혁.', con: '정책 정상화.' },
    { amc: '신한자산운용', asOf: '2026-06-20', market: '베트남', index: 'VN-Index', view: '중립', targetLow: 1200, targetHigh: 1380, pro: 'FDI 수혜.', con: '환율.' },
    { amc: '신한자산운용', asOf: '2026-06-20', market: '인도', index: 'Nifty50', view: '강세', targetLow: 23000, targetHigh: 26500, pro: '내수·인프라.', con: '밸류 부담.' },
    { amc: '신한자산운용', asOf: '2026-06-20', market: 'ACWI', index: 'MSCI ACWI', view: '중립', targetLow: 790, targetHigh: 880, pro: '분산 성장.', con: '지정학.' },
    { amc: '신한자산운용', asOf: '2026-06-20', market: '선진국', index: 'MSCI World', view: '강세', targetLow: 3500, targetHigh: 3850, pro: '미국 주도.', con: '유럽 혼조.' }
  ]
};
