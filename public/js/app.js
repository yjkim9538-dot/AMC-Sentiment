/*
 * AMC 증시 컨센서스 대시보드 — 메인 로직
 * 백엔드 없이 브라우저에서 엑셀(SheetJS)을 파싱하여 4개 뷰로 렌더링합니다.
 */
(function () {
  'use strict';

  // 방향성 / 의견 도메인
  var VIEW_KEYS = ['강세', '중립', '약세'];
  var OPINION_KEYS = ['매수', '중립', '매도'];
  var OVERSEAS_MARKETS = ['미국', '일본', '베트남', '인도', 'ACWI', '선진국'];

  // 전체 종합(운용사별 최신) 특수 회차값 — 백엔드 getConsensus 와 약속된 토큰
  var ALL_PERIODS = '__all__';

  var state = null;          // 현재 표시 중인 정규화 데이터
  var backend = false;       // 백엔드(서버) 사용 가능 여부
  var chatEnabled = false;   // AI 챗봇(ANTHROPIC_API_KEY) 가용 여부
  var periods = [];          // 회차 목록
  var currentPeriod = null;  // 현재 선택된 회차
  var chatHistory = [];      // 챗봇 대화 이력 [{q, a}]

  // ---------- 유틸 ----------
  function el(id) { return document.getElementById(id); }

  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || ('HTTP ' + r.status)); });
      return r.json();
    });
  }

  function viewClass(v) {
    if (v === '강세') return 'bull';
    if (v === '약세') return 'bear';
    return 'neutral';
  }
  function opinionClass(o) {
    if (o === '매수') return 'bull';
    if (o === '매도') return 'bear';
    return 'neutral';
  }
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmt(n) { return n === null || n === undefined ? '-' : n.toLocaleString('ko-KR'); }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // 날짜 표기 통일 → 'YYYY-MM-DD'
  // 엑셀 날짜 셀은 직렬값(예: 46123)으로 읽히므로 날짜로 되돌리고,
  // '2026.7.6' / '2026/07/06' / '2026년 7월 6일' 같은 표기도 한 형식으로 맞춘다.
  function fmtDate(v) {
    if (v === null || v === undefined) return '';
    var s = String(v).trim();
    if (!s) return '';
    if (/^\d+(\.\d+)?$/.test(s)) {
      var n = Number(s);
      // 1954~2064년 범위의 직렬값만 날짜로 간주(그 외 숫자는 원문 유지)
      if (n >= 20000 && n <= 60000) {
        var d = new Date(Math.round((n - 25569) * 86400000)); // 25569 = 1970-01-01의 엑셀 직렬값
        return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
      }
      return s;
    }
    var m = s.match(/^(\d{4})\s*[.\/\-년]\s*(\d{1,2})\s*[.\/\-월]\s*(\d{1,2})/);
    if (m) return m[1] + '-' + pad2(Number(m[2])) + '-' + pad2(Number(m[3]));
    return s;
  }

  function uniqueAMCs(data) {
    var seen = {}, out = [];
    data.domesticMarket.concat(data.overseas).forEach(function (r) {
      if (r.amc && !seen[r.amc]) { seen[r.amc] = true; out.push(r.amc); }
    });
    data.domesticStocks.forEach(function (r) {
      if (r.amc && !seen[r.amc]) { seen[r.amc] = true; out.push(r.amc); }
    });
    return out;
  }

  function showToast(msg, isError) {
    var t = el('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(function () { t.className = 'toast'; }, 3200);
  }

  // ---------- 집계 ----------
  function countViews(rows) {
    var c = { 강세: 0, 중립: 0, 약세: 0 };
    rows.forEach(function (r) { if (c[r.view] !== undefined) c[r.view]++; });
    return c;
  }
  function countOpinions(rows) {
    var c = { 매수: 0, 중립: 0, 매도: 0 };
    rows.forEach(function (r) { if (c[r.opinion] !== undefined) c[r.opinion]++; });
    return c;
  }
  function avgBand(rows) {
    var lows = [], highs = [];
    rows.forEach(function (r) {
      if (r.targetLow !== null) lows.push(r.targetLow);
      if (r.targetHigh !== null) highs.push(r.targetHigh);
    });
    var avg = function (a) { return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : null; };
    return { low: avg(lows), high: avg(highs) };
  }

  // ---------- 컴포넌트 헬퍼 ----------
  function distBar(counts, keys, classFn) {
    var total = keys.reduce(function (s, k) { return s + counts[k]; }, 0);
    if (!total) return '';
    var segs = keys.map(function (k) {
      if (!counts[k]) return '';
      var pct = (counts[k] / total) * 100;
      return '<div class="dist-seg ' + classFn(k) + '" style="width:' + pct + '%" title="' +
        esc(k) + ' ' + counts[k] + '">' + (pct >= 12 ? counts[k] : '') + '</div>';
    }).join('');
    var legend = keys.map(function (k) {
      return '<span class="lg-' + classFn(k) + '">' + esc(k) + ' ' + counts[k] + '</span>';
    }).join('');
    return '<div class="dist-bar">' + segs + '</div><div class="dist-legend">' + legend + '</div>';
  }

  function badge(text, cls) { return '<span class="badge ' + cls + '">' + esc(text) + '</span>'; }

  // 전체 종합 화면에서 각 의견이 어느 회차 데이터인지 표시
  function periodTag(r) {
    if (!state.meta || !state.meta.combined || !r.period) return '';
    return '<span class="row-period">' + esc(r.period) + '</span>';
  }

  // 전 운용사의 Pro/Con 의견을 모아 운용사명과 함께 목록화
  function summaryList(rows, key) {
    var items = rows.filter(function (r) { return r[key]; }).map(function (r) {
      return '<li><span class="sl-amc">' + esc(r.amc) + '</span><span class="sl-text">' + esc(r[key]) + '</span></li>';
    }).join('');
    if (!items) return '<div class="pc-text muted">의견 없음</div>';
    return '<ul class="summary-list">' + items + '</ul>';
  }
  function countWithReason(rows, key) {
    return rows.filter(function (r) { return r[key]; }).length;
  }

  // ---------- 뷰 1: 국내 통합 ----------
  function renderDomesticOverview() {
    var host = el('domestic-overview');
    var mkt = state.domesticMarket;
    if (!mkt.length && !state.domesticStocks.length) {
      host.innerHTML = '<div class="empty">국내 데이터가 없습니다.</div>';
      return;
    }
    var counts = countViews(mkt);
    var band = avgBand(mkt);

    var html = '';
    html += '<div class="section-title">국내 증시 전망 요약</div>';
    html += '<div class="card-row">';
    html += '<div class="card summary-card"><div class="label">응답 운용사</div><div class="value">' + mkt.length + '<small> 곳</small></div></div>';
    html += '<div class="card summary-card"><div class="label">KOSPI 목표밴드 평균</div><div class="value">' +
      fmt(band.low) + '<small> ~ ' + fmt(band.high) + '</small></div></div>';
    html += '<div class="card summary-card" style="flex:2 1 320px"><div class="label">방향성 분포</div>' +
      distBar(counts, VIEW_KEYS, viewClass) + '</div>';
    html += '</div>';

    // 운용사 의견 종합 (긍정 / 부정)
    html += '<div class="section-title">운용사 의견 종합 — 긍정 · 부정</div>';
    html += '<div class="procon">' +
      '<div class="procon-box pro"><div class="pc-label">긍정 요인 (Pro) · ' +
      countWithReason(mkt, 'pro') + '개사</div>' + summaryList(mkt, 'pro') + '</div>' +
      '<div class="procon-box con"><div class="pc-label">부정 요인 (Con) · ' +
      countWithReason(mkt, 'con') + '개사</div>' + summaryList(mkt, 'con') + '</div>' +
      '</div>';

    // 운용사별 비교 표
    html += '<div class="section-title">운용사별 시장 전망</div>';
    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>운용사</th><th>방향성</th><th>KOSPI 목표밴드</th><th>Pro (긍정)</th><th>Con (부정)</th>' +
      '</tr></thead><tbody>';
    mkt.forEach(function (r) {
      html += '<tr class="clickable" data-amc="' + esc(r.amc) + '">' +
        '<td><strong>' + esc(r.amc) + '</strong>' + periodTag(r) + '</td>' +
        '<td>' + badge(r.view, viewClass(r.view)) + '</td>' +
        '<td class="cell-num">' + fmt(r.targetLow) + ' ~ ' + fmt(r.targetHigh) + '</td>' +
        '<td class="cell-reason">' + esc(r.pro) + '</td>' +
        '<td class="cell-reason">' + esc(r.con) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';

    // 종목 의견 집계
    html += '<div class="section-title">국내 종목 매수/매도 의견 집계</div>';
    html += renderStockAggTable();

    host.innerHTML = html;

    // 행 클릭 → 운용사별 뷰
    host.querySelectorAll('tr.clickable[data-amc]').forEach(function (tr) {
      tr.addEventListener('click', function () { goToAMC('domestic-amc', tr.getAttribute('data-amc')); });
    });
    bindStockExpand(host);
  }

  function aggregateStocks() {
    var map = {};
    state.domesticStocks.forEach(function (r) {
      if (!r.stock) return;
      if (!map[r.stock]) map[r.stock] = { stock: r.stock, rows: [], counts: { 매수: 0, 중립: 0, 매도: 0 } };
      map[r.stock].rows.push(r);
      if (map[r.stock].counts[r.opinion] !== undefined) map[r.stock].counts[r.opinion]++;
    });
    var arr = Object.keys(map).map(function (k) { return map[k]; });
    // 추천(매수) 많은 순, 그다음 응답 수 많은 순
    arr.sort(function (a, b) {
      if (b.counts['매수'] !== a.counts['매수']) return b.counts['매수'] - a.counts['매수'];
      return b.rows.length - a.rows.length;
    });
    return arr;
  }

  function renderStockAggTable() {
    var agg = aggregateStocks();
    if (!agg.length) return '<div class="empty">종목 의견 데이터가 없습니다.</div>';
    var html = '<div class="table-wrap"><table><thead><tr>' +
      '<th>종목</th><th class="cell-center">응답 운용사</th><th>의견 분포 (매수·중립·매도)</th><th></th>' +
      '</tr></thead><tbody>';
    agg.forEach(function (g, i) {
      html += '<tr class="clickable" data-expand="stk-' + i + '">' +
        '<td><strong>' + esc(g.stock) + '</strong></td>' +
        '<td class="cell-center">' + g.rows.length + '</td>' +
        '<td>' + distBar(g.counts, OPINION_KEYS, opinionClass) + '</td>' +
        '<td class="cell-center muted">▼ 상세</td>' +
        '</tr>';
      var items = g.rows.map(function (r) {
        return '<li><span class="el-amc">' + esc(r.amc) + '</span>' +
          badge(r.opinion, opinionClass(r.opinion)) + periodTag(r) +
          ' <span class="sp-reason">' + esc(r.reason) + '</span></li>';
      }).join('');
      html += '<tr class="expand-row" id="stk-' + i + '" style="display:none"><td colspan="4">' +
        '<ul class="expand-list">' + items + '</ul></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function bindStockExpand(host) {
    host.querySelectorAll('tr.clickable[data-expand]').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        e.stopPropagation();
        var row = el(tr.getAttribute('data-expand'));
        if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
      });
    });
  }

  // ---------- 뷰 2: 국내 운용사별 ----------
  function renderDomesticByAMC(selected) {
    var host = el('domestic-amc');
    var amcs = uniqueAMCs(state);
    if (!amcs.length) { host.innerHTML = '<div class="empty">국내 데이터가 없습니다.</div>'; return; }
    var current = selected && amcs.indexOf(selected) >= 0 ? selected : amcs[0];

    var html = '<div class="selector-row"><label for="sel-dom-amc">운용사 선택</label>' +
      '<select id="sel-dom-amc">' + amcs.map(function (a) {
        return '<option value="' + esc(a) + '"' + (a === current ? ' selected' : '') + '>' + esc(a) + '</option>';
      }).join('') + '</select></div>';

    var m = state.domesticMarket.filter(function (r) { return r.amc === current; })[0];
    if (m) {
      html += '<div class="card">';
      html += '<div class="detail-head"><h3>' + esc(current) + '</h3>' +
        badge(m.view, viewClass(m.view)) +
        '<span class="band">KOSPI ' + fmt(m.targetLow) + ' ~ ' + fmt(m.targetHigh) + '</span>' +
        (m.asOf ? '<span class="muted">작성일 ' + esc(fmtDate(m.asOf)) + '</span>' : '') +
        (state.meta && state.meta.combined && m.period ? '<span class="muted">회차 ' + esc(m.period) + '</span>' : '') +
        '</div>';
      html += '<div class="procon">' +
        '<div class="procon-box pro"><div class="pc-label">Pro · 긍정 사유</div><div class="pc-text">' + esc(m.pro) + '</div></div>' +
        '<div class="procon-box con"><div class="pc-label">Con · 부정 사유</div><div class="pc-text">' + esc(m.con) + '</div></div>' +
        '</div></div>';
    }

    var picks = state.domesticStocks.filter(function (r) { return r.amc === current; });
    html += '<div class="section-title">종목 Top Pick</div>';
    if (picks.length) {
      html += '<div class="card">';
      picks.forEach(function (p) {
        html += '<div class="stock-pick"><span class="sp-name">' + esc(p.stock) + '</span>' +
          badge(p.opinion, opinionClass(p.opinion)) +
          '<span class="sp-reason">' + esc(p.reason) + '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="empty">해당 운용사의 종목 의견이 없습니다.</div>';
    }

    host.innerHTML = html;
    el('sel-dom-amc').addEventListener('change', function () { renderDomesticByAMC(this.value); });
  }

  // ---------- 뷰 3: 해외 통합 ----------
  // 국내 통합과 같은 양식(전망 요약 카드 → 긍정/부정 종합 → 운용사별 표)을
  // 시장 선택 칩으로 시장별로 보여주고, 하단에 전체 매트릭스를 유지한다.
  function renderOverseasOverview(selectedMarket) {
    var host = el('overseas-overview');
    var rows = state.overseas;
    if (!rows.length) { host.innerHTML = '<div class="empty">해외 데이터가 없습니다.</div>'; return; }
    var amcs = uniqueAMCs(state).filter(function (a) {
      return rows.some(function (r) { return r.amc === a; });
    });
    var markets = OVERSEAS_MARKETS.filter(function (mk) {
      return rows.some(function (r) { return r.market === mk; });
    });
    // 데이터에만 있는 기타 시장도 포함
    rows.forEach(function (r) { if (r.market && markets.indexOf(r.market) < 0) markets.push(r.market); });

    var current = selectedMarket && markets.indexOf(selectedMarket) >= 0 ? selectedMarket : markets[0];
    var mkt = rows.filter(function (r) { return r.market === current; });
    var counts = countViews(mkt);
    var band = avgBand(mkt);
    var indexName = '';
    mkt.forEach(function (r) { if (!indexName && r.index) indexName = r.index; });

    var html = '<div class="market-chips">' + markets.map(function (mk) {
      return '<button type="button" class="market-chip' + (mk === current ? ' is-active' : '') +
        '" data-market="' + esc(mk) + '">' + esc(mk) + '</button>';
    }).join('') + '</div>';

    html += '<div class="section-title">' + esc(current) + ' 증시 전망 요약' +
      (indexName ? ' <span class="muted">· ' + esc(indexName) + '</span>' : '') + '</div>';
    html += '<div class="card-row">';
    html += '<div class="card summary-card"><div class="label">응답 운용사</div><div class="value">' + mkt.length + '<small> 곳</small></div></div>';
    html += '<div class="card summary-card"><div class="label">' + esc(indexName || '지수') + ' 목표밴드 평균</div><div class="value">' +
      fmt(band.low) + '<small> ~ ' + fmt(band.high) + '</small></div></div>';
    html += '<div class="card summary-card" style="flex:2 1 320px"><div class="label">방향성 분포</div>' +
      distBar(counts, VIEW_KEYS, viewClass) + '</div>';
    html += '</div>';

    // 운용사 의견 종합 (긍정 / 부정)
    html += '<div class="section-title">운용사 의견 종합 — 긍정 · 부정</div>';
    html += '<div class="procon">' +
      '<div class="procon-box pro"><div class="pc-label">긍정 요인 (Pro) · ' +
      countWithReason(mkt, 'pro') + '개사</div>' + summaryList(mkt, 'pro') + '</div>' +
      '<div class="procon-box con"><div class="pc-label">부정 요인 (Con) · ' +
      countWithReason(mkt, 'con') + '개사</div>' + summaryList(mkt, 'con') + '</div>' +
      '</div>';

    // 운용사별 비교 표
    html += '<div class="section-title">운용사별 시장 전망</div>';
    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>운용사</th><th>방향성</th><th>목표밴드</th><th>Pro (긍정)</th><th>Con (부정)</th>' +
      '</tr></thead><tbody>';
    mkt.forEach(function (r) {
      html += '<tr class="clickable" data-amc="' + esc(r.amc) + '">' +
        '<td><strong>' + esc(r.amc) + '</strong>' + periodTag(r) + '</td>' +
        '<td>' + badge(r.view, viewClass(r.view)) + '</td>' +
        '<td class="cell-num">' + fmt(r.targetLow) + ' ~ ' + fmt(r.targetHigh) + '</td>' +
        '<td class="cell-reason">' + esc(r.pro) + '</td>' +
        '<td class="cell-reason">' + esc(r.con) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';

    // 전체 시장 한눈 요약 매트릭스
    var lookup = {};
    rows.forEach(function (r) { lookup[r.amc + '||' + r.market] = r; });
    html += '<div class="section-title">전체 시장 × 운용사 방향성 매트릭스</div>';
    html += '<div class="muted" style="margin-bottom:10px">시장 행을 클릭하면 위 요약이 해당 시장으로 전환됩니다.</div>';
    html += '<div class="table-wrap"><table class="matrix"><thead><tr><th class="market-col">시장</th>';
    amcs.forEach(function (a) { html += '<th>' + esc(a) + '</th>'; });
    html += '<th>방향성 분포</th></tr></thead><tbody>';
    markets.forEach(function (mk) {
      var marketRows = rows.filter(function (r) { return r.market === mk; });
      var c = countViews(marketRows);
      html += '<tr class="clickable" data-market-row="' + esc(mk) + '"><td class="market-name">' + esc(mk) + '</td>';
      amcs.forEach(function (a) {
        var r = lookup[a + '||' + mk];
        html += '<td>' + (r ? badge(r.view, viewClass(r.view)) : '<span class="muted">-</span>') + '</td>';
      });
      html += '<td style="min-width:200px">' + distBar(c, VIEW_KEYS, viewClass) + '</td></tr>';
    });
    html += '</tbody></table></div>';

    host.innerHTML = html;
    host.querySelectorAll('.market-chip').forEach(function (b) {
      b.addEventListener('click', function () { renderOverseasOverview(b.getAttribute('data-market')); });
    });
    host.querySelectorAll('tr.clickable[data-amc]').forEach(function (tr) {
      tr.addEventListener('click', function () { goToAMC('overseas-amc', tr.getAttribute('data-amc')); });
    });
    host.querySelectorAll('tr.clickable[data-market-row]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        renderOverseasOverview(tr.getAttribute('data-market-row'));
        host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ---------- 뷰 4: 해외 운용사별 ----------
  function renderOverseasByAMC(selected) {
    var host = el('overseas-amc');
    var rows = state.overseas;
    if (!rows.length) { host.innerHTML = '<div class="empty">해외 데이터가 없습니다.</div>'; return; }
    var amcs = uniqueAMCs(state).filter(function (a) {
      return rows.some(function (r) { return r.amc === a; });
    });
    var current = selected && amcs.indexOf(selected) >= 0 ? selected : amcs[0];

    var html = '<div class="selector-row"><label for="sel-ov-amc">운용사 선택</label>' +
      '<select id="sel-ov-amc">' + amcs.map(function (a) {
        return '<option value="' + esc(a) + '"' + (a === current ? ' selected' : '') + '>' + esc(a) + '</option>';
      }).join('') + '</select></div>';

    var mine = rows.filter(function (r) { return r.amc === current; });
    html += '<div class="market-grid">';
    mine.forEach(function (r) {
      html += '<div class="card market-card">' +
        '<div class="mc-head"><div><div class="mc-title">' + esc(r.market) + '</div>' +
        '<div class="mc-index">' + esc(r.index || '') + '</div></div>' + badge(r.view, viewClass(r.view)) + '</div>' +
        '<div class="band" style="margin:6px 0 10px">목표밴드 ' + fmt(r.targetLow) + ' ~ ' + fmt(r.targetHigh) + '</div>' +
        '<div class="procon">' +
        '<div class="procon-box pro"><div class="pc-label">Pro</div><div class="pc-text">' + esc(r.pro) + '</div></div>' +
        '<div class="procon-box con"><div class="pc-label">Con</div><div class="pc-text">' + esc(r.con) + '</div></div>' +
        '</div></div>';
    });
    html += '</div>';

    host.innerHTML = html;
    el('sel-ov-amc').addEventListener('change', function () { renderOverseasByAMC(this.value); });
  }

  // ---------- 뷰 5: 회차 추이 ----------
  function renderTrend() {
    var host = el('trend');
    if (!backend) {
      host.innerHTML = '<div class="empty">회차 추이는 백엔드 서버 실행 시 제공됩니다.<br>' +
        '<span class="muted">server 디렉터리에서 <code>npm start</code> 후 접속하세요.</span></div>';
      return;
    }
    api('/api/trend').then(function (res) {
      var trend = res.trend || [];
      if (!trend.length) { host.innerHTML = '<div class="empty">추이 데이터가 없습니다.</div>'; return; }
      var html = '<div class="section-title">회차별 국내 증시 방향성 추이</div>';
      html += trendTable(trend, 'domestic');
      html += '<div class="section-title">회차별 해외 증시 방향성 추이</div>';
      html += trendTable(trend, 'overseas');
      host.innerHTML = html;
    }).catch(function () {
      host.innerHTML = '<div class="empty">추이를 불러오지 못했습니다.</div>';
    });
  }
  function trendTable(trend, key) {
    var html = '<div class="table-wrap"><table><thead><tr>' +
      '<th>회차</th><th>응답 운용사</th><th>방향성 분포 (강세·중립·약세)</th></tr></thead><tbody>';
    trend.forEach(function (t) {
      html += '<tr><td><strong>' + esc(t.period) + '</strong></td>' +
        '<td class="cell-center">' + t.amcCount + '</td>' +
        '<td style="min-width:260px">' + distBar(t[key], VIEW_KEYS, viewClass) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  // ---------- 렌더 전체 ----------
  function renderAll() {
    renderDomesticOverview();
    renderDomesticByAMC();
    renderOverseasOverview();
    renderOverseasByAMC();
    renderTrend();
    el('data-source').textContent = state.meta.source || '데이터';
    el('data-asof').textContent = state.meta.asOf ? (backend ? '회차 ' : '기준일 ') + state.meta.asOf : '';
  }

  // ---------- 탭 ----------
  function activateTab(id) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-tab') === id);
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.id === id);
    });
  }
  function goToAMC(tabId, amc) {
    activateTab(tabId);
    if (tabId === 'domestic-amc') renderDomesticByAMC(amc);
    else if (tabId === 'overseas-amc') renderOverseasByAMC(amc);
  }

  // ---------- 엑셀 파싱 ----------
  // 파서는 운용사 업로드 페이지와 공용 — js/xlsx-parse.js (window.AMCParse)

  // 여러 파일을 한 번에 처리 — 모두 합쳐 한 회차로 누적(백엔드) / 미리보기(오프라인).
  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    Promise.all(files.map(AMCParse.readWorkbook)).then(function (results) {
      var ok = results.filter(function (r) { return AMCParse.hasData(r.parsed); });
      var failed = results.length - ok.length;
      if (!ok.length) {
        showToast('인식 가능한 데이터가 없습니다. 양식(국내시장/국내종목/해외 시트)을 확인해 주세요.', true);
        return;
      }
      // 모든 파일 병합
      var merged = { domesticMarket: [], domesticStocks: [], overseas: [] };
      ok.forEach(function (r) {
        merged.domesticMarket = merged.domesticMarket.concat(r.parsed.domesticMarket);
        merged.domesticStocks = merged.domesticStocks.concat(r.parsed.domesticStocks);
        merged.overseas = merged.overseas.concat(r.parsed.overseas);
      });
      var label = ok.length + '개 파일' + (failed ? ' (' + failed + '개 제외)' : '');
      if (backend) {
        submitToBackend(merged, label);
      } else {
        merged.meta = { source: '업로드(로컬): ' + label, asOf: new Date().toLocaleDateString('ko-KR') };
        state = merged;
        renderAll();
        showToast('업로드 완료(로컬) · ' + label);
      }
    }).catch(function (err) {
      console.error(err);
      showToast('파일을 읽는 중 오류가 발생했습니다.', true);
    });
  }

  // 파싱 결과를 운용사별로 묶어 백엔드에 저장(회차는 자유 입력, 기본값=오늘 날짜).
  function submitToBackend(parsed, fileName) {
    // 운용사 수집(수령 시점이 비정기적이므로 회차 라벨은 사용자가 자유 입력)
    var byAMC = {};
    function bucket(a) { if (!byAMC[a]) byAMC[a] = { amc: a, domesticMarket: null, domesticStocks: [], overseas: [] }; return byAMC[a]; }
    parsed.domesticMarket.forEach(function (r) {
      var b = bucket(r.amc);
      b.domesticMarket = { asOf: r.asOf, view: r.view, targetLow: r.targetLow, targetHigh: r.targetHigh, pro: r.pro, con: r.con };
    });
    parsed.domesticStocks.forEach(function (r) {
      bucket(r.amc).domesticStocks.push({ stock: r.stock, opinion: r.opinion, reason: r.reason });
    });
    parsed.overseas.forEach(function (r) {
      bucket(r.amc).overseas.push({ asOf: r.asOf, market: r.market, index: r.index, view: r.view, targetLow: r.targetLow, targetHigh: r.targetHigh, pro: r.pro, con: r.con });
    });
    var submissions = Object.keys(byAMC).map(function (k) { return byAMC[k]; });

    var today = new Date().toISOString().slice(0, 10);
    var label = window.prompt(
      '저장할 회차(수령 기준) 라벨을 입력하세요.\n수령 간격이 비정기적이므로 날짜로 관리하는 것을 권장합니다.\n예: ' + today + ' 또는 "2026-06 미래에셋 수시"',
      currentPeriod && periods.length ? today : today
    );
    if (label === null) return; // 취소
    label = label.trim();
    if (!label) { showToast('회차 라벨이 비어 있어 저장을 취소했습니다.', true); return; }

    api('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: label, submissions: submissions })
    }).then(function (res) {
      return loadPeriods(label).then(function () {
        showUploadSummary(label, res.results || [], fileName);
      });
    }).catch(function (err) {
      showToast('저장 실패: ' + err.message, true);
    });
  }

  // 업로드 결과 요약 모달 — 저장된 운용사(신규/갱신) 목록을 보여준다.
  function showUploadSummary(period, results, fileName) {
    var news = results.filter(function (r) { return r.status === 'new'; });
    var ups = results.filter(function (r) { return r.status === 'updated'; });
    function chips(arr) {
      return arr.map(function (r) { return '<span class="amc-chip">' + esc(r.amc) + '</span>'; }).join('');
    }
    var html =
      '<div class="modal-card">' +
        '<div class="modal-head">업로드 완료 — 회차 “' + esc(period) + '”</div>' +
        '<div class="modal-body">' +
          '<p class="modal-sum">저장된 운용사 <strong>' + results.length + '곳</strong>' +
            (fileName ? ' <span class="muted">· ' + esc(fileName) + '</span>' : '') + '</p>' +
          (news.length ? '<div class="modal-group"><div class="mg-title new">신규 ' + news.length + '</div><div class="amc-chips">' + chips(news) + '</div></div>' : '') +
          (ups.length ? '<div class="modal-group"><div class="mg-title upd">갱신 ' + ups.length + ' <span class="muted">(화면은 최신 반영 · 과거 이력은 서버에 보존)</span></div><div class="amc-chips">' + chips(ups) + '</div></div>' : '') +
        '</div>' +
        '<div class="modal-foot"><button class="btn btn-primary" id="modal-ok">확인</button></div>' +
      '</div>';
    var back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = html;
    document.body.appendChild(back);
    function close() { back.remove(); }
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    back.querySelector('#modal-ok').addEventListener('click', close);
  }

  // ---------- 회차 ----------
  function loadPeriods(selectPeriod) {
    return api('/api/periods').then(function (res) {
      periods = res.periods || [];
      var sel = el('period-select');
      if (!periods.length) {
        sel.innerHTML = '<option value="">데이터 없음</option>';
        currentPeriod = null;
        state = { domesticMarket: [], domesticStocks: [], overseas: [], meta: { source: '데이터 없음' } };
        renderAll();
        return;
      }
      // 기본은 '전체 종합(운용사별 최신)'. 업로드 직후에는 해당 회차를 선택.
      currentPeriod = selectPeriod && (selectPeriod === ALL_PERIODS ||
        periods.some(function (p) { return p.period === selectPeriod; }))
        ? selectPeriod : ALL_PERIODS;
      sel.innerHTML = '<option value="' + ALL_PERIODS + '"' +
        (currentPeriod === ALL_PERIODS ? ' selected' : '') + '>전체 종합 (운용사별 최신)</option>' +
        periods.map(function (p) {
          return '<option value="' + esc(p.period) + '"' + (p.period === currentPeriod ? ' selected' : '') +
            '>' + esc(p.period) + ' (' + p.amcCount + '개사)</option>';
        }).join('');
      return loadConsensus(currentPeriod);
    });
  }
  function loadConsensus(period) {
    return api('/api/consensus?period=' + encodeURIComponent(period)).then(function (res) {
      res.meta = period === ALL_PERIODS
        ? { source: '전체 종합 · 운용사별 최신 제출만 반영', asOf: '', combined: true }
        : { source: '회차: ' + period, asOf: period };
      state = res;
      renderAll();
    });
  }

  // 양식 다운로드는 정적 파일(public/templates/AMC_컨센서스_양식.xlsx)을 링크로 제공한다.
  // (드롭다운·서식이 적용된 가독성 높은 양식 — index.html 의 #btn-template 앵커)

  // ---------- AI 챗봇 ----------
  var CHAT_SUGGESTIONS = [
    '이번 회차 KOSPI를 강세로 본 운용사는?',
    '회차 대비 국내 방향성이 바뀐 운용사 알려줘',
    '삼성전자에 대한 운용사별 의견 정리',
    '해외 시장 중 가장 강세 의견이 많은 곳은?'
  ];
  function renderSuggest() {
    var box = el('chat-suggest');
    if (!box) return;
    box.innerHTML = CHAT_SUGGESTIONS.map(function (q) {
      return '<button type="button" class="chat-chip">' + esc(q) + '</button>';
    }).join('');
    box.querySelectorAll('.chat-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        el('chat-input').value = b.textContent;
        sendChat();
      });
    });
  }
  function openChat(open) {
    el('chat-drawer').classList.toggle('is-open', open);
    el('chat-drawer').setAttribute('aria-hidden', open ? 'false' : 'true');
    el('chat-backdrop').hidden = !open;
    if (open) setTimeout(function () { el('chat-input').focus(); }, 50);
  }
  function addChatMsg(role, text, pending) {
    var box = el('chat-messages');
    var div = document.createElement('div');
    div.className = 'chat-msg ' + role + (pending ? ' pending' : '');
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }
  function sendChat() {
    var input = el('chat-input');
    var q = input.value.trim();
    if (!q) return;
    if (!backend) { addChatMsg('bot', 'AI 챗봇은 백엔드 서버 실행 시 사용할 수 있습니다.'); return; }
    if (!chatEnabled) { addChatMsg('bot', 'AI 챗봇을 쓰려면 서버에 ANTHROPIC_API_KEY를 설정하세요. (그 외 기능은 정상 동작합니다.)'); input.value = ''; return; }
    addChatMsg('user', q);
    input.value = '';
    var pending = addChatMsg('bot', '생각 중…', true);
    api('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, history: chatHistory.slice(-6) })
    }).then(function (res) {
      pending.remove();
      var a = res.answer || '(응답 없음)';
      addChatMsg('bot', a);
      if (res.available) chatHistory.push({ q: q, a: a });
    }).catch(function (err) {
      pending.remove();
      addChatMsg('bot', '오류: ' + err.message);
    });
  }

  // ---------- 뷰 6: 제출 관리(관리자 마스터) ----------
  function fmtDateTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch (e) { return iso; }
  }

  // 제출 1건의 내용 상세(국내 시장/종목/해외) — 이력 행 펼침에 사용
  function submissionDetailHtml(data) {
    var d = data || {};
    var html = '';
    if (d.domesticMarket) {
      var m = d.domesticMarket;
      html += '<div class="sd-block"><div class="sd-title">국내 시장</div><div class="sd-line">' +
        badge(m.view || '-', viewClass(m.view)) +
        ' <span class="band">KOSPI ' + fmt(m.targetLow) + ' ~ ' + fmt(m.targetHigh) + '</span>' +
        (m.asOf ? ' <span class="muted">작성일 ' + esc(m.asOf) + '</span>' : '') + '</div>' +
        (m.pro ? '<div class="sd-line"><strong class="sd-pro">Pro</strong> ' + esc(m.pro) + '</div>' : '') +
        (m.con ? '<div class="sd-line"><strong class="sd-con">Con</strong> ' + esc(m.con) + '</div>' : '') +
        '</div>';
    }
    var stocks = d.domesticStocks || [];
    if (stocks.length) {
      html += '<div class="sd-block"><div class="sd-title">국내 종목 · ' + stocks.length + '건</div><ul class="expand-list">' +
        stocks.map(function (s) {
          return '<li><span class="el-amc">' + esc(s.stock) + '</span>' + badge(s.opinion, opinionClass(s.opinion)) +
            ' <span class="sp-reason">' + esc(s.reason) + '</span></li>';
        }).join('') + '</ul></div>';
    }
    var ovs = d.overseas || [];
    if (ovs.length) {
      html += '<div class="sd-block"><div class="sd-title">해외 시장 · ' + ovs.length + '건</div><ul class="expand-list">' +
        ovs.map(function (o) {
          return '<li><span class="el-amc">' + esc(o.market) + '</span>' + badge(o.view, viewClass(o.view)) +
            ' <span class="muted">' + fmt(o.targetLow) + ' ~ ' + fmt(o.targetHigh) + '</span>' +
            (o.pro ? '<div class="sd-line"><strong class="sd-pro">Pro</strong> ' + esc(o.pro) + '</div>' : '') +
            (o.con ? '<div class="sd-line"><strong class="sd-con">Con</strong> ' + esc(o.con) + '</div>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }
    return html || '<span class="muted">데이터 없음</span>';
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); resolve(); } catch (e) { reject(e); }
      ta.remove();
    });
  }

  function adminAction(body) {
    return api('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  function renderAdmin() {
    var host = el('admin');
    if (!backend) { host.innerHTML = '<div class="empty">제출 관리는 데이터 저장소 연결 시 제공됩니다.</div>'; return; }
    host.innerHTML = '<div class="empty">불러오는 중…</div>';
    api('/api/admin').then(function (res) {
      renderAdminBody(host, res);
    }).catch(function (err) {
      host.innerHTML = '<div class="empty">불러오기 실패: ' + esc(err.message) + '</div>';
    });
  }

  function renderAdminBody(host, res) {
    var html = '';

    // 1) 접수 회차
    html += '<div class="section-title">접수 회차 설정</div>';
    html += '<div class="card"><div class="adm-row">' +
      '<input id="adm-period" type="text" class="adm-input" placeholder="예: 2026-3Q 또는 2026-07-21" value="' + esc(res.activePeriod) + '" />' +
      '<button class="btn btn-primary" id="adm-period-save" type="button">저장</button></div>' +
      '<p class="muted" style="margin:10px 0 0">운용사가 링크로 업로드하면 이 회차로 저장됩니다. 비워 두면 업로드 당일 날짜로 저장됩니다.</p></div>';

    // 2) 운용사 업로드 링크
    html += '<div class="section-title">운용사 업로드 링크</div>';
    html += '<div class="card">';
    if (res.links.length) {
      html += '<div class="table-wrap"><table><thead><tr>' +
        '<th>운용사</th><th>업로드 링크</th><th>발급일</th><th class="cell-center">동작</th>' +
        '</tr></thead><tbody>';
      res.links.forEach(function (l) {
        var url = location.origin + '/u/' + l.token;
        html += '<tr><td><strong>' + esc(l.amc) + '</strong></td>' +
          '<td><code class="link-code" title="' + esc(url) + '">' + esc(url) + '</code></td>' +
          '<td class="muted">' + esc(fmtDateTime(l.created_at)) + '</td>' +
          '<td class="cell-center adm-acts">' +
          '<button type="button" class="btn btn-mini btn-primary" data-copy="' + esc(url) + '">복사</button>' +
          '<button type="button" class="btn btn-mini btn-plain" data-rotate="' + esc(l.amc) + '">재발급</button>' +
          '<button type="button" class="btn btn-mini btn-danger" data-del="' + esc(l.amc) + '">삭제</button>' +
          '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<p class="muted" style="margin:0">발급된 링크가 없습니다. 운용사명을 입력해 링크를 발급한 뒤, 해당 운용사에게만 전달하세요.</p>';
    }
    html += '<div class="adm-row" style="margin-top:12px">' +
      '<input id="adm-new-amc" type="text" class="adm-input" placeholder="운용사명 입력 (예: KB자산운용)" />' +
      '<button class="btn btn-accent" id="adm-link-create" type="button">링크 발급</button></div>';
    if (res.knownAmcs && res.knownAmcs.length) {
      html += '<div class="muted" style="margin-top:10px">제출 이력은 있으나 링크가 없는 운용사 — 눌러서 바로 발급:</div>' +
        '<div class="amc-chips" style="margin-top:6px">' +
        res.knownAmcs.map(function (a) {
          return '<button type="button" class="amc-chip amc-chip-btn" data-quick="' + esc(a) + '">' + esc(a) + ' +</button>';
        }).join('') + '</div>';
    }
    html += '<p class="muted" style="margin:12px 0 0">링크를 받은 운용사는 로그인 없이 본인 파일 업로드와 본인 제출 이력만 볼 수 있습니다. ' +
      '링크가 외부로 유출되면 "재발급"으로 즉시 무효화하세요.</p>';
    html += '</div>';

    // 3) 전체 업로드·수정 이력 (append-only 원본 전부)
    html += '<div class="section-title">전체 업로드 · 수정 이력 <span class="muted">(' + res.history.length + '건)</span></div>';
    if (!res.history.length) {
      html += '<div class="empty">아직 제출 이력이 없습니다.</div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr>' +
        '<th>운용사</th><th>제출 일시</th><th>회차</th><th>구분</th><th>반영</th><th></th>' +
        '</tr></thead><tbody>';
      res.history.forEach(function (h, i) {
        html += '<tr class="clickable" data-expand="hist-' + i + '">' +
          '<td><strong>' + esc(h.amc) + '</strong></td>' +
          '<td class="muted">' + esc(fmtDateTime(h.created_at)) + '</td>' +
          '<td>' + esc(h.period) + '</td>' +
          '<td>' + (h.revision === 'update' ? badge('수정 제출', 'warn') : badge('최초 제출', 'neutral')) + '</td>' +
          '<td>' + (h.current ? badge('최신 반영', 'ok') : badge('이전본', 'off')) + '</td>' +
          '<td class="cell-center muted">▼ 상세</td></tr>';
        html += '<tr class="expand-row" id="hist-' + i + '" style="display:none"><td colspan="6">' +
          submissionDetailHtml(h.data) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    host.innerHTML = html;

    // 바인딩
    el('adm-period-save').addEventListener('click', function () {
      adminAction({ action: 'set-period', period: el('adm-period').value.trim() }).then(function (r) {
        showToast(r.activePeriod
          ? '접수 회차를 "' + r.activePeriod + '"(으)로 설정했습니다.'
          : '접수 회차를 비웠습니다 — 업로드 당일 날짜로 저장됩니다.');
      }).catch(function (e) { showToast('저장 실패: ' + e.message, true); });
    });
    function createFor(name) {
      if (!name) { showToast('운용사명을 입력하세요.', true); return; }
      adminAction({ action: 'link-create', amc: name }).then(function () {
        renderAdmin();
        showToast('"' + name + '" 업로드 링크를 발급했습니다.');
      }).catch(function (e) { showToast('발급 실패: ' + e.message, true); });
    }
    el('adm-link-create').addEventListener('click', function () { createFor(el('adm-new-amc').value.trim()); });
    el('adm-new-amc').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); createFor(e.target.value.trim()); }
    });
    host.querySelectorAll('[data-quick]').forEach(function (b) {
      b.addEventListener('click', function () { createFor(b.getAttribute('data-quick')); });
    });
    host.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        copyText(b.getAttribute('data-copy'))
          .then(function () { showToast('링크를 복사했습니다.'); })
          .catch(function () { showToast('복사에 실패했습니다 — 링크를 직접 선택해 복사하세요.', true); });
      });
    });
    host.querySelectorAll('[data-rotate]').forEach(function (b) {
      b.addEventListener('click', function () {
        var amc = b.getAttribute('data-rotate');
        if (!window.confirm('"' + amc + '" 링크를 재발급할까요?\n기존 링크는 즉시 사용할 수 없게 됩니다.')) return;
        adminAction({ action: 'link-rotate', amc: amc }).then(function () {
          renderAdmin();
          showToast('재발급 완료 — 새 링크를 해당 운용사에 다시 전달하세요.');
        }).catch(function (e) { showToast('재발급 실패: ' + e.message, true); });
      });
    });
    host.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var amc = b.getAttribute('data-del');
        if (!window.confirm('"' + amc + '" 링크를 삭제할까요?\n해당 운용사는 더 이상 업로드할 수 없습니다. (이미 제출된 데이터는 유지됩니다)')) return;
        adminAction({ action: 'link-delete', amc: amc }).then(function () {
          renderAdmin();
          showToast('링크를 삭제했습니다.');
        }).catch(function (e) { showToast('삭제 실패: ' + e.message, true); });
      });
    });
    bindStockExpand(host);
  }

  // ---------- 초기화 ----------
  function init() {
    // 공통 UI 바인딩
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        var id = t.getAttribute('data-tab');
        activateTab(id);
        if (id === 'admin') renderAdmin(); // 관리 탭은 열 때마다 최신 상태 로드
      });
    });
    el('file-input').addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) handleFiles(e.target.files);
      e.target.value = '';
    });
    el('btn-chat').addEventListener('click', function () { openChat(true); });
    el('chat-close').addEventListener('click', function () { openChat(false); });
    el('chat-backdrop').addEventListener('click', function () { openChat(false); });
    el('chat-form').addEventListener('submit', function (e) { e.preventDefault(); sendChat(); });
    el('chat-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
    renderSuggest();
    el('period-select').addEventListener('change', function () {
      if (backend && this.value) { currentPeriod = this.value; loadConsensus(this.value); }
    });

    // 백엔드 감지 → 있으면 데이터 저장소 모드, 없으면 샘플(로컬) 모드
    el('btn-logout').addEventListener('click', function () {
      fetch('/api/logout', { method: 'POST' }).then(function () { location.reload(); });
    });

    api('/api/health').then(function (h) {
      backend = true;
      chatEnabled = !!h.chat;
      if (h.auth) el('btn-logout').hidden = false;
      el('data-source').textContent = '데이터 저장소 연결됨';
      addChatMsg('bot', chatEnabled
        ? '안녕하세요. 누적된 컨센서스 데이터에 대해 질문해 주세요. 예) "2026 2Q에 KOSPI를 강세로 본 운용사는?"'
        : 'AI 챗봇은 서버에 ANTHROPIC_API_KEY가 설정되면 활성화됩니다. (대시보드/데이터 누적은 정상 동작합니다.)');
      return loadPeriods();
    }).catch(function () {
      // 오프라인(정적 파일) 모드 — 샘플 데이터
      backend = false;
      var sel = el('period-select');
      sel.innerHTML = '<option>샘플 데이터</option>';
      sel.disabled = true;
      state = window.SAMPLE_DATA;
      renderAll();
      el('data-source').textContent = '샘플 데이터 (오프라인)';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
