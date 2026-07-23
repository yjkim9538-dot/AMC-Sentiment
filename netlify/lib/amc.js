// 운용사명 정규화 — 같은 회사가 표기 차이로 두 회사처럼 집계·표시되는 것을 방지.
// 예: "다올자산운용(주)"·"(주)다올자산운용"·"다올자산운용 주식회사" → "다올자산운용"
//     "마이다스자산운용" → "마이다스에셋자산운용"

// 법인 접두·접미 표기만으로 걸러지지 않는 알려진 표기 변형 → 정식 명칭.
// 새 변형이 발견되면 여기에 추가한다.
const ALIASES = {
  마이다스자산운용: '마이다스에셋자산운용',
};

const CORP_PREFIX = /^\s*(?:\(주\)|㈜|주식회사)\s*/;
const CORP_SUFFIX = /\s*(?:\(주\)|㈜|주식회사)\s*$/;

export function normalizeAmc(name) {
  const s = String(name || '')
    .replace(CORP_PREFIX, '')
    .replace(CORP_SUFFIX, '')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES[s] || s;
}
