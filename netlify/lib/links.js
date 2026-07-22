// 운용사별 비밀 업로드 링크(토큰) 레지스트리 + 앱 설정(접수 회차) — Netlify Blobs.
// 링크 URL 은 /u/<token> 형태. 토큰이 곧 인증이므로 링크는 해당 운용사에게만 전달한다.

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

export async function listLinks(store) {
  const map = await loadJson(store, LINKS_KEY, {});
  return Object.keys(map)
    .sort()
    .map((amc) => ({ amc, token: map[amc].token, created_at: map[amc].created_at }));
}

// 이미 있으면 기존 링크 반환(중복 발급 방지), 없으면 새로 발급.
export async function createLink(store, amc) {
  const map = await loadJson(store, LINKS_KEY, {});
  if (!map[amc]) {
    map[amc] = { token: newToken(), created_at: new Date().toISOString() };
    await store.setJSON(LINKS_KEY, map);
  }
  return { amc, ...map[amc] };
}

// 여러 운용사 일괄 발급 — 한 번의 읽기/쓰기로 처리. 이미 발급된 운용사는 기존 링크 유지.
export async function createLinks(store, amcs) {
  const map = await loadJson(store, LINKS_KEY, {});
  let changed = false;
  const out = [];
  for (const raw of amcs) {
    const amc = String(raw || '').trim();
    if (!amc) continue;
    if (!map[amc]) {
      map[amc] = { token: newToken(), created_at: new Date().toISOString() };
      changed = true;
    }
    out.push({ amc, ...map[amc] });
  }
  if (changed) await store.setJSON(LINKS_KEY, map);
  return out;
}

// 재발급 — 기존 링크는 즉시 무효화된다(유출 대응).
export async function rotateLink(store, amc) {
  const map = await loadJson(store, LINKS_KEY, {});
  map[amc] = { token: newToken(), created_at: new Date().toISOString() };
  await store.setJSON(LINKS_KEY, map);
  return { amc, ...map[amc] };
}

export async function deleteLink(store, amc) {
  const map = await loadJson(store, LINKS_KEY, {});
  if (map[amc]) {
    delete map[amc];
    await store.setJSON(LINKS_KEY, map);
  }
}

export async function findAmcByToken(store, token) {
  if (!token || !/^[a-f0-9]{16,64}$/.test(token)) return null;
  const map = await loadJson(store, LINKS_KEY, {});
  for (const amc of Object.keys(map)) {
    if (map[amc].token === token) return amc;
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
