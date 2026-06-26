import { getConsensus } from '../../lib/db.js';

export async function onRequestGet({ env, request }) {
  const period = (new URL(request.url).searchParams.get('period') || '').trim();
  if (!period) return Response.json({ error: 'period 파라미터가 필요합니다.' }, { status: 400 });
  return Response.json(await getConsensus(env.DB, period));
}
