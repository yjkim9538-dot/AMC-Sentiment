import { getEnv } from '../lib/ctx.js';
import { getTrend } from '../lib/db.js';

export default async () => {
  const env = getEnv();
  return Response.json({ trend: await getTrend(env.DB) });
};

export const config = { path: '/api/trend', method: ['GET'] };
