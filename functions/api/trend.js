import { getTrend } from '../../lib/db.js';

export async function onRequestGet({ env }) {
  return Response.json({ trend: await getTrend(env.DB) });
}
