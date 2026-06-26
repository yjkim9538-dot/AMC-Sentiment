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

  // 시트 이름(엑셀)
  var SHEET = { market: '국내시장', stock: '국내종목', overseas: '해외' };

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
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(String(v).replace(/[, ]/g, ''));
    return isNaN(n) ? null : n;
  }
  function fmt(n) { return n === null ? '-' : n.toLocaleString('ko-KR'); }

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
        '<td><strong>' + esc(r.amc) + '</strong></td>' +
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
          badge(r.opinion, opinionClass(r.opinion)) +
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
        '<span class="muted">작성일 ' + esc(m.asOf) + '</span></div>';
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
  function renderOverseasOverview() {
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

    var lookup = {};
    rows.forEach(function (r) { lookup[r.amc + '||' + r.market] = r; });

    var html = '<div class="section-title">시장 × 운용사 방향성 매트릭스</div>';
    html += '<div class="muted" style="margin-bottom:10px">행(시장)을 클릭하면 운용사별 Pro/Con 상세가 펼쳐집니다.</div>';
    html += '<div class="table-wrap"><table class="matrix"><thead><tr><th class="market-col">시장</th>';
    amcs.forEach(function (a) { html += '<th>' + esc(a) + '</th>'; });
    html += '<th>방향성 분포</th></tr></thead><tbody>';

    markets.forEach(function (mk, i) {
      var marketRows = rows.filter(function (r) { return r.market === mk; });
      var counts = countViews(marketRows);
      html += '<tr class="clickable" data-expand="ov-' + i + '"><td class="market-name">' + esc(mk) + '</td>';
      amcs.forEach(function (a) {
        var r = lookup[a + '||' + mk];
        html += '<td>' + (r ? badge(r.view, viewClass(r.view)) : '<span class="muted">-</span>') + '</td>';
      });
      html += '<td style="min-width:200px">' + distBar(counts, VIEW_KEYS, viewClass) + '</td></tr>';

      var items = marketRows.map(function (r) {
        return '<li><span class="el-amc">' + esc(r.amc) + '</span>' + badge(r.view, viewClass(r.view)) +
          ' <span class="muted">목표 ' + fmt(r.targetLow) + '~' + fmt(r.targetHigh) +
          (r.index ? ' · ' + esc(r.index) : '') + '</span>' +
          '<div class="sp-reason" style="margin-top:4px"><strong style="color:var(--bull)">Pro</strong> ' + esc(r.pro) +
          ' &nbsp; <strong style="color:var(--bear)">Con</strong> ' + esc(r.con) + '</div></li>';
      }).join('');
      html += '<tr class="expand-row" id="ov-' + i + '" style="display:none"><td colspan="' + (amcs.length + 2) +
        '"><ul class="expand-list">' + items + '</ul></td></tr>';
    });
    html += '</tbody></table></div>';

    host.innerHTML = html;
    bindStockExpand(host);
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
  function sheetToRows(wb, name) {
    var ws = wb.Sheets[name];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  }
  function pick(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (row[k] !== undefined && row[k] !== '') return row[k];
    }
    // 부분 일치(공백/괄호 차이 대응)
    var rk = Object.keys(row);
    for (var j = 0; j < keys.length; j++) {
      for (var m = 0; m < rk.length; m++) {
        if (rk[m].replace(/[\s()（）]/g, '').indexOf(keys[j].replace(/[\s()（）]/g, '')) >= 0) {
          if (row[rk[m]] !== '') return row[rk[m]];
        }
      }
    }
    return '';
  }

  // 양식의 안내/예시 행은 데이터에서 제외
  function isGuideRow(amc) {
    if (!amc) return true;
    return /^※/.test(amc) || /작성요령/.test(amc) || /^\(예시\)/.test(amc);
  }

  function parseWorkbook(wb) {
    var mRows = sheetToRows(wb, SHEET.market);
    var sRows = sheetToRows(wb, SHEET.stock);
    var oRows = sheetToRows(wb, SHEET.overseas);

    var domesticMarket = mRows.map(function (r) {
      return {
        amc: String(pick(r, ['운용사명', '운용사'])).trim(),
        asOf: String(pick(r, ['작성일'])).trim(),
        view: String(pick(r, ['방향성', '전망'])).trim(),
        targetLow: num(pick(r, ['KOSPI목표_하단', '목표_하단', '하단'])),
        targetHigh: num(pick(r, ['KOSPI목표_상단', '목표_상단', '상단'])),
        pro: String(pick(r, ['Pro(긍정사유)', 'Pro', '긍정사유', '긍정'])).trim(),
        con: String(pick(r, ['Con(부정사유)', 'Con', '부정사유', '부정'])).trim()
      };
    }).filter(function (r) { return r.amc && !isGuideRow(r.amc); });

    var domesticStocks = sRows.map(function (r) {
      return {
        amc: String(pick(r, ['운용사명', '운용사'])).trim(),
        stock: String(pick(r, ['종목명', '종목'])).trim(),
        opinion: String(pick(r, ['의견'])).trim(),
        reason: String(pick(r, ['사유', '의견사유'])).trim()
      };
    }).filter(function (r) { return r.amc && r.stock && !isGuideRow(r.amc); });

    var overseas = oRows.map(function (r) {
      return {
        amc: String(pick(r, ['운용사명', '운용사'])).trim(),
        asOf: String(pick(r, ['작성일'])).trim(),
        market: String(pick(r, ['시장'])).trim(),
        index: String(pick(r, ['기준지수', '지수'])).trim(),
        view: String(pick(r, ['방향성', '전망'])).trim(),
        targetLow: num(pick(r, ['목표_하단', '하단'])),
        targetHigh: num(pick(r, ['목표_상단', '상단'])),
        pro: String(pick(r, ['Pro(긍정사유)', 'Pro', '긍정사유', '긍정'])).trim(),
        con: String(pick(r, ['Con(부정사유)', 'Con', '부정사유', '부정'])).trim()
      };
    }).filter(function (r) { return r.amc && r.market && !isGuideRow(r.amc); });

    return { domesticMarket: domesticMarket, domesticStocks: domesticStocks, overseas: overseas };
  }

  // 엑셀 한 개를 읽어 파싱(Promise). 실패해도 reject 하지 않고 parsed:null 로 반환.
  function readWorkbook(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          resolve({ fileName: file.name, parsed: parseWorkbook(wb) });
        } catch (err) {
          console.error(err);
          resolve({ fileName: file.name, parsed: null });
        }
      };
      reader.onerror = function () { resolve({ fileName: file.name, parsed: null }); };
      reader.readAsArrayBuffer(file);
    });
  }

  function hasData(p) {
    return p && (p.domesticMarket.length || p.domesticStocks.length || p.overseas.length);
  }

  // 여러 파일을 한 번에 처리 — 모두 합쳐 한 회차로 누적(백엔드) / 미리보기(오프라인).
  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    Promise.all(files.map(readWorkbook)).then(function (results) {
      var ok = results.filter(function (r) { return hasData(r.parsed); });
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
      showToast('저장 완료 · 회차 "' + label + '" · 운용사 ' + res.saved + '곳 (' + fileName + ')');
      return loadPeriods(label);
    }).catch(function (err) {
      showToast('저장 실패: ' + err.message, true);
    });
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
      currentPeriod = selectPeriod && periods.some(function (p) { return p.period === selectPeriod; })
        ? selectPeriod : periods[0].period;
      sel.innerHTML = periods.map(function (p) {
        return '<option value="' + esc(p.period) + '"' + (p.period === currentPeriod ? ' selected' : '') +
          '>' + esc(p.period) + ' (' + p.amcCount + '개사)</option>';
      }).join('');
      return loadConsensus(currentPeriod);
    });
  }
  function loadConsensus(period) {
    return api('/api/consensus?period=' + encodeURIComponent(period)).then(function (res) {
      res.meta = { source: '회차: ' + period, asOf: period };
      state = res;
      renderAll();
    });
  }

  // ---------- 양식 다운로드 ----------
  function downloadTemplate() {
    var wb = XLSX.utils.book_new();

    var marketAOA = [
      ['운용사명', '작성일', '방향성', 'KOSPI목표_하단', 'KOSPI목표_상단', 'Pro(긍정사유)', 'Con(부정사유)'],
      ['※ 작성요령', 'YYYY-MM-DD', '강세/중립/약세 중 택1', '예: 2700', '예: 3000', '상승 요인 서술', '하락 요인 서술'],
      ['(예시)미래에셋자산운용', '2026-06-20', '강세', 2750, 3050, '반도체 업황 회복, 외국인 순매수', '금리 인하 지연, 중국 둔화']
    ];
    var stockAOA = [
      ['운용사명', '종목명', '의견', '사유'],
      ['※ 작성요령', '자유 선정(Top Pick)', '매수/중립/매도 중 택1', '투자의견 사유 서술'],
      ['(예시)미래에셋자산운용', '삼성전자', '매수', 'HBM 경쟁력 회복, 메모리 업황 반등']
    ];
    var overseasAOA = [
      ['운용사명', '작성일', '시장', '기준지수', '방향성', '목표_하단', '목표_상단', 'Pro(긍정사유)', 'Con(부정사유)'],
      ['※ 작성요령', 'YYYY-MM-DD', '미국/일본/베트남/인도/ACWI/선진국', '예: S&P500', '강세/중립/약세', '예: 5400', '예: 6000', '상승 요인', '하락 요인'],
      ['(예시)미래에셋자산운용', '2026-06-20', '미국', 'S&P500', '강세', 5400, 6000, 'AI 투자 지속', '밸류에이션 부담']
    ];
    // 해외 6개 시장 빈 행 가이드
    OVERSEAS_MARKETS.forEach(function (mk) {
      overseasAOA.push(['', '', mk, '', '', '', '', '', '']);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(marketAOA), SHEET.market);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stockAOA), SHEET.stock);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overseasAOA), SHEET.overseas);
    XLSX.writeFile(wb, 'AMC_컨센서스_양식.xlsx');
    showToast('엑셀 양식을 다운로드했습니다.');
  }

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

  // ---------- 초기화 ----------
  function init() {
    // 공통 UI 바인딩
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { activateTab(t.getAttribute('data-tab')); });
    });
    el('file-input').addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) handleFiles(e.target.files);
      e.target.value = '';
    });
    el('btn-template').addEventListener('click', downloadTemplate);
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
    api('/api/health').then(function (h) {
      backend = true;
      chatEnabled = !!h.chat;
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
