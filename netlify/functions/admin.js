// 관리자(마스터) API — 접수 회차 설정, 운용사 업로드 링크 발급/재발급/삭제, 전체 제출·수정 이력.
// 엣지 게이트(쿠키 인증)를 통과해야 접근 가능(공개 경로 아님).
import { getEnv } from '../lib/ctx.js';
import { getHistory } from '../lib/db.js';
import {
  listLinks, createLink, createLinks, rotateLink, deleteLink,
  getSettings, setActivePeriod,
} from '../lib/links.js';

export default async (request) => {
  const env = getEnv();
  const store = env.DB;

  if (request.method === 'GET') {
    const [links, settings, history] = await Promise.all([
      listLinks(store), getSettings(store), getHistory(store),
    ]);
    // 제출 이력에는 있으나 링크 미발급인 운용사 — 빠르게 발급할 수 있게 제안 목록으로 제공
    const known = new Set(history.map((r) => r.amc));
    links.forEach((l) => known.delete(l.amc));
    return Response.json({
      activePeriod: settings.activePeriod || '',
      links,
      knownAmcs: [...known].sort(),
      history,
    });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === 'set-period') {
    const s = await setActivePeriod(store, String(body.period || '').trim());
    return Response.json({ ok: true, activePeriod: s.activePeriod });
  }

  if (action === 'link-create-bulk') {
    const amcs = Array.isArray(body.amcs) ? body.amcs : [];
    if (!amcs.length) return Response.json({ error: '운용사명 목록이 필요합니다.' }, { status: 400 });
    return Response.json({ ok: true, links: await createLinks(store, amcs) });
  }

  const amc = String(body.amc || '').trim();
  if (!amc) return Response.json({ error: '운용사명이 필요합니다.' }, { status: 400 });
  if (action === 'link-create') return Response.json({ ok: true, link: await createLink(store, amc) });
  if (action === 'link-rotate') return Response.json({ ok: true, link: await rotateLink(store, amc) });
  if (action === 'link-delete') { await deleteLink(store, amc); return Response.json({ ok: true }); }
  return Response.json({ error: '알 수 없는 action 입니다.' }, { status: 400 });
};

export const config = { path: '/api/admin', method: ['GET', 'POST'] };
