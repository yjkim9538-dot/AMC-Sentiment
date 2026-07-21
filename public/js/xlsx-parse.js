/*
 * AMC 컨센서스 엑셀 파서(공용) — 대시보드(관리자 업로드)와 운용사 업로드 페이지가 함께 사용.
 * SheetJS(XLSX) 전역이 먼저 로드되어 있어야 한다. window.AMCParse 로 노출.
 */
(function () {
  'use strict';

  // 시트 이름(엑셀)
  var SHEET = { market: '국내시장', stock: '국내종목', overseas: '해외' };

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(String(v).replace(/[, ]/g, ''));
    return isNaN(n) ? null : n;
  }

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

  // 시트를 객체 배열로 변환. 헤더가 1행이 아니어도(제목·안내 행이 위에 있어도)
  // '운용사명'이 들어간 행을 찾아 그 행을 헤더로 사용한다.
  function sheetToRows(wb, name) {
    var ws = wb.Sheets[name];
    if (!ws) return [];
    var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!aoa.length) return [];
    var hi = -1;
    for (var i = 0; i < Math.min(aoa.length, 20); i++) {
      var norm = (aoa[i] || []).map(function (x) { return String(x).replace(/\s/g, ''); });
      if (norm.indexOf('운용사명') >= 0 || norm.indexOf('운용사') >= 0) { hi = i; break; }
    }
    if (hi < 0) hi = 0;
    var headers = (aoa[hi] || []).map(function (x) { return String(x).trim(); });
    var out = [];
    for (var r = hi + 1; r < aoa.length; r++) {
      var arr = aoa[r] || [];
      var obj = {}, any = false;
      for (var c = 0; c < headers.length; c++) {
        if (!headers[c]) continue;
        var v = arr[c] === undefined ? '' : arr[c];
        obj[headers[c]] = v;
        if (String(v).trim() !== '') any = true;
      }
      if (any) out.push(obj);
    }
    return out;
  }

  function pick(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (row[k] !== undefined && row[k] !== '') return row[k];
    }
    // 부분 일치(공백/괄호/밑줄 차이 대응 — 양식 헤더 표기가 달라도 인식)
    var norm = function (x) { return x.replace(/[\s()（）_]/g, ''); };
    var rk = Object.keys(row);
    for (var j = 0; j < keys.length; j++) {
      for (var m = 0; m < rk.length; m++) {
        if (norm(rk[m]).indexOf(norm(keys[j])) >= 0) {
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

  // 운용사명을 행마다 다시 적지 않아도 되도록 — 빈 칸은 위에서 마지막으로 본
  // (예시 아닌) 운용사명을 상속받는다. 한 파일은 한 운용사 작성 기준.
  function effAmc(rows, fallback) {
    var last = '', out = [];
    for (var i = 0; i < rows.length; i++) {
      var a = String(pick(rows[i], ['운용사명', '운용사'])).trim();
      if (a) {
        // 값이 있는 칸: 예시(안내)행이면 상속하지 않고 빈값으로 둬 downstream 필터가 제거,
        // 실제 운용사명이면 그대로 쓰고 이후 행이 상속할 기준으로 기억한다.
        if (isGuideRow(a)) { out.push(''); }
        else { last = a; out.push(a); }
      } else {
        out.push(last || fallback || ''); // 빈 칸 → 위 운용사명(또는 파일 단일 운용사명) 상속
      }
    }
    return out;
  }

  function parseWorkbook(wb) {
    var mRows = sheetToRows(wb, SHEET.market);
    var sRows = sheetToRows(wb, SHEET.stock);
    var oRows = sheetToRows(wb, SHEET.overseas);

    var mAmc = effAmc(mRows, '');
    var domesticMarket = mRows.map(function (r, i) {
      return {
        amc: mAmc[i],
        asOf: fmtDate(pick(r, ['작성일'])),
        view: String(pick(r, ['방향성', '전망'])).trim(),
        targetLow: num(pick(r, ['KOSPI목표_하단', '목표_하단', '하단'])),
        targetHigh: num(pick(r, ['KOSPI목표_상단', '목표_상단', '상단'])),
        pro: String(pick(r, ['Pro(긍정사유)', 'Pro', '긍정사유', '긍정'])).trim(),
        con: String(pick(r, ['Con(부정사유)', 'Con', '부정사유', '부정'])).trim()
      };
    }).filter(function (r) { return r.amc && !isGuideRow(r.amc); });

    // 종목·해외 시트에서 운용사명이 비어 있으면, 시장 시트의 단일 운용사명으로 보완
    var distinct = {};
    domesticMarket.forEach(function (r) { if (r.amc) distinct[r.amc] = 1; });
    var dkeys = Object.keys(distinct);
    var fileAmc = dkeys.length === 1 ? dkeys[0] : '';

    var sAmc = effAmc(sRows, fileAmc);
    var domesticStocks = sRows.map(function (r, i) {
      return {
        amc: sAmc[i],
        stock: String(pick(r, ['종목명', '종목'])).trim(),
        opinion: String(pick(r, ['의견'])).trim(),
        reason: String(pick(r, ['사유', '의견사유'])).trim()
      };
    }).filter(function (r) { return r.amc && r.stock && !isGuideRow(r.amc); });

    var oAmc = effAmc(oRows, fileAmc);
    var overseas = oRows.map(function (r, i) {
      return {
        amc: oAmc[i],
        asOf: fmtDate(pick(r, ['작성일'])),
        market: String(pick(r, ['시장'])).trim(),
        index: String(pick(r, ['기준지수', '지수'])).trim(),
        view: String(pick(r, ['방향성', '전망'])).trim(),
        targetLow: num(pick(r, ['목표_하단', '하단'])),
        targetHigh: num(pick(r, ['목표_상단', '상단'])),
        pro: String(pick(r, ['Pro(긍정사유)', 'Pro', '긍정사유', '긍정'])).trim(),
        con: String(pick(r, ['Con(부정사유)', 'Con', '부정사유', '부정'])).trim()
      };
    }).filter(function (r) {
      // 시장명만 미리 채워진(운용사가 작성하지 않은) 빈 행은 제외 — 실제 내용이 있어야 채택
      var hasContent = r.view || r.targetLow || r.targetHigh || r.pro || r.con;
      return r.amc && r.market && hasContent && !isGuideRow(r.amc);
    });

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

  window.AMCParse = {
    parseWorkbook: parseWorkbook,
    readWorkbook: readWorkbook,
    hasData: hasData,
    fmtDate: fmtDate,
    num: num
  };
})();
