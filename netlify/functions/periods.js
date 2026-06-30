import { getEnv } from '../lib/ctx.js';
import { listPeriods } from '../lib/db.js';

export default async () => {
  const env = getEnv();
  return Response.json({ periods: await listPeriods(env.DB) });
};

export const config = { path: '/api/periods', method: ['GET'] };
