import { listPeriods } from '../../lib/db.js';

export async function onRequestGet({ env }) {
  return Response.json({ periods: await listPeriods(env.DB) });
}
