import { getEnv } from '../lib/ctx.js';
import { countRows } from '../lib/db.js';
import { chatAvailable } from '../lib/chat.js';
import { authEnabled } from '../lib/auth.js';

export default async () => {
  const env = getEnv();
  return Response.json({
    ok: true,
    rows: await countRows(env.DB),
    chat: chatAvailable(env),
    auth: authEnabled(env),
  });
};

export const config = { path: '/api/health', method: ['GET'] };
