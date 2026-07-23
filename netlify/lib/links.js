// 운용사별 비밀 업로드 링크(토큰) 레지스트리 + 앱 설정(접수 회차) — Netlify Blobs.
// 링크 URL 은 /u/<token> 형태. 토큰이 곧 인증이므로 링크는 해당 운용사에게만 전달한다.

import { normalizeAmc } from './amc.js';

const LINKS_KEY = 'amc_links';
const SETTINGS_KEY = 'app_settings';

async function loadJson(store, key, fallback) {
  const v = await store.get(key, { type: 'json', consistency: 'strong' });
  return v === null || v === undefined ? fallback : v;
}

function newToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 저장된 키에 표기 변형("다올자산운용(주)" 등)이 섞여 있어도 정식 명칭으로 묶어서 다룬다.
// 같은 회사로 정규화되는 키가 여럿이면 가장 최근 발급분을 대표로 사용.
function rawKeysFor(map, canonAmc) {
  return Object.keys(map).filter((k) => normalizeAmc(k) === canonAmc);
}

function latestEntryFor(map, canonAmc) {
  let best = null;
  for (const k of rawKeysFor(map, canonAmc)) {
    if (!best || (map[k].created_at || '') > (best.created_at || '')) best = map[k];
  }
  return best;
}

export async function listLinks(store) {
  const map = await loadJson(store, LINKS_KEY, {});
  const canon = [...new Set(Object.keys(map).map(normalizeAmc))].sort();
  return canon.map((amc) => {
    const e = latestEntryFor(map, amc);
    return { amc, token: e.token, created_at: e.created_at };
  });
}

// 이미 있으면 기존 링크 반환(중복 발급 방지), 없으면 새로 발급.
export async function createLink(store, amc) {
  amc = normalizeAmc(amc);
  const map = await loadJson(store, LINKS_KEY, {});
  const existing = latestEntryFor(map, amc);
  if (existing) return { amc, ...existing };
  map[amc] = { token: newToken(), created_at: new Date().toISOString() };
  await store.setJSON(LINKS_KEY, map);
  return { amc, ...map[amc] };
}

// 재발급 — 기존 링크(표기 변형으로 저장된 것 포함)는 즉시 무효화된다(유출 대응).
export async function rotateLink(store, amc) {
  amc = normalizeAmc(amc);
  const map = await loadJson(store, LINKS_KEY, {});
  for (const k of rawKeysFor(map, amc)) delete map[k];
  map[amc] = { token: newToken(), created_at: new Date().toISOString() };
  await store.setJSON(LINKS_KEY, map);
  return { amc, ...map[amc] };
}

export async function deleteLink(store, amc) {
  amc = normalizeAmc(amc);
  const map = await loadJson(store, LINKS_KEY, {});
  const keys = rawKeysFor(map, amc);
  if (keys.length) {
    for (const k of keys) delete map[k];
    await store.setJSON(LINKS_KEY, map);
  }
}

export async function findAmcByToken(store, token) {
  if (!token || !/^[a-f0-9]{16,64}$/.test(token)) return null;
  const map = await loadJson(store, LINKS_KEY, {});
  for (const amc of Object.keys(map)) {
    // 변형 표기로 발급됐던 기존 링크도 계속 동작하되, 제출은 정식 명칭으로 저장된다.
    if (map[amc].token === token) return normalizeAmc(amc);
  }
  return null;
}

export async function getSettings(store) {
  return loadJson(store, SETTINGS_KEY, {});
}

export async function setActivePeriod(store, period) {
  const s = await getSettings(store);
  s.activePeriod = period || '';
  await store.setJSON(SETTINGS_KEY, s);
  return s;
}
