/*
 * 운용사 업로드 포털 — 비밀 링크(/u/<token>)로 접근.
 * 본인 파일 업로드 + 본인 제출 이력 조회만 가능. 운용사명은 서버가 토큰에서 강제한다.
 */
(function () {
  'use strict';

  var VIEW_CLS = { 강세: 'bull', 약세: 'bear' };
  var OPI_CLS = { 매수: 'bull', 매도: 'bear' };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmt(n) { return n === null || n === undefined ? '-' : Number(n).toLocaleString('ko-KR'); }
  function badge(text, cls) { return '<span class="badge ' + (cls || 'neutral') + '">' + esc(text) + '</span>'; }
  function viewClass(v) { return VIEW_CLS[v] || 'neutral'; }
  function opinionClass(o) { return OPI_CLS[o] || 'neutral'; }

  function fmtDateTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch (e) { return iso; }
  }

  function showToast(msg, isError) {
    var t = el('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(function () { t.className = 'toast'; }, 3800);
  }

  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || ('HTTP ' + r.status)); });
      return r.json();
    });
  }

  // 토큰: /u/<token> 경로 또는 ?t= 쿼리에서 읽는다.
  var token = (location.pathname.match(/^\/u\/([A-Za-z0-9]+)/) || [])[1] ||
    new URLSearchParams(location.search).get('t') || '';

  var me = null; // {amc, activePeriod, submissions}

  function showError(msg) {
    el('portal-main').classList.remove('is-active');
    el('portal-error').classList.add('is-active');
    el('portal-error-msg').innerHTML = esc(msg);
    el('portal-amc').textContent = '접근 불가';
  }

  function load() {
    if (!token) { showError('업로드 링크가 올바르지 않습니다. 군인공제회 담당자에게 받은 링크로 다시 접속해 주세요.'); return; }
    api('/api/portal?token=' + encodeURIComponent(token)).then(function (res) {
      me = res;
      el('portal-error').classList.remove('is-active');
      el('portal-main').classList.add('is-active');
      el('portal-amc').textContent = res.amc;
      el('portal-period').textContent = res.activePeriod
        ? '현재 접수 회차: ' + res.activePeriod
        : '접수 회차 미지정 — 업로드 당일 날짜로 저장됩니다';
      renderHistory(res.submissions || []);
    }).catch(function (err) {
      showError(err.message);
    });
  }

  function detailHtml(data) {
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

  function renderHistory(rows) {
    var host = el('portal-history');
    if (!rows.length) {
      host.innerHTML = '<div class="empty">아직 제출한 파일이 없습니다.<br><span class="muted">위에서 엑셀 양식을 내려받아 작성 후 업로드해 주세요.</span></div>';
      return;
    }
    var html = '<div class="table-wrap"><table><thead><tr>' +
      '<th>제출 일시</th><th>회차</th><th>구분</th><th>반영</th><th></th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (h, i) {
      html += '<tr class="clickable" data-expand="my-' + i + '">' +
        '<td><strong>' + esc(fmtDateTime(h.created_at)) + '</strong></td>' +
        '<td>' + esc(h.period) + '</td>' +
        '<td>' + (h.revision === 'update' ? badge('수정 제출', 'warn') : badge('최초 제출', 'neutral')) + '</td>' +
        '<td>' + (h.current ? badge('최신 반영', 'ok') : badge('이전본', 'off')) + '</td>' +
        '<td class="cell-center muted">▼ 상세</td></tr>';
      html += '<tr class="expand-row" id="my-' + i + '" style="display:none"><td colspan="5">' +
        detailHtml(h.data) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    host.innerHTML = html;
    host.querySelectorAll('tr.clickable[data-expand]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var row = el(tr.getAttribute('data-expand'));
        if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
      });
    });
  }

  // 파싱 결과에서 이 운용사의 제출 데이터 1건을 구성.
  // 파일 안의 운용사명은 저장에 사용하지 않는다(서버가 토큰의 운용사명으로 강제).
  function buildData(parsed) {
    var m = parsed.domesticMarket.length ? parsed.domesticMarket[parsed.domesticMarket.length - 1] : null;
    return {
      domesticMarket: m ? { asOf: m.asOf, view: m.view, targetLow: m.targetLow, targetHigh: m.targetHigh, pro: m.pro, con: m.con } : null,
      domesticStocks: parsed.domesticStocks.map(function (r) {
        return { stock: r.stock, opinion: r.opinion, reason: r.reason };
      }),
      overseas: parsed.overseas.map(function (r) {
        return { asOf: r.asOf, market: r.market, index: r.index, view: r.view, targetLow: r.targetLow, targetHigh: r.targetHigh, pro: r.pro, con: r.con };
      })
    };
  }

  function handleFile(file) {
    el('portal-uploading').hidden = false;
    AMCParse.readWorkbook(file).then(function (result) {
      if (!AMCParse.hasData(result.parsed)) {
        el('portal-uploading').hidden = true;
        showToast('인식 가능한 데이터가 없습니다. 양식(국내시장/국내종목/해외 시트)을 확인해 주세요.', true);
        return;
      }
      // 파일 안의 운용사명이 등록된 운용사명과 다르면 확인 후 진행(저장은 어차피 등록명으로 강제)
      var names = {};
      result.parsed.domesticMarket.concat(result.parsed.domesticStocks, result.parsed.overseas)
        .forEach(function (r) { if (r.amc) names[r.amc] = 1; });
      var others = Object.keys(names).filter(function (n) { return n !== me.amc; });
      if (others.length) {
        var ok = window.confirm(
          '파일에 적힌 운용사명(' + others.join(', ') + ')이 등록된 운용사명(' + me.amc + ')과 다릅니다.\n' +
          '"' + me.amc + '" 명의로 제출됩니다. 계속할까요?');
        if (!ok) { el('portal-uploading').hidden = true; return; }
      }
      return api('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, data: buildData(result.parsed) })
      }).then(function (res) {
        el('portal-uploading').hidden = true;
        showToast('제출 완료 — 회차 "' + res.period + '" · ' +
          (res.status === 'updated' ? '수정 제출로 반영되었습니다.' : '정상 접수되었습니다.'));
        load(); // 이력 갱신
      });
    }).catch(function (err) {
      el('portal-uploading').hidden = true;
      showToast('제출 실패: ' + err.message, true);
    });
  }

  function init() {
    el('portal-file').addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) handleFile(e.target.files[0]);
      e.target.value = '';
    });
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
