import { getEnv } from '../lib/ctx.js';
import { getConsensus } from '../lib/db.js';

export default async (request) => {
  const env = getEnv();
  const period = (new URL(request.url).searchParams.get('period') || '').trim();
  if (!period) return Response.json({ error: 'period 파라미터가 필요합니다.' }, { status: 400 });
  return Response.json(await getConsensus(env.DB, period));
};

export const config = { path: '/api/consensus', method: ['GET'] };
