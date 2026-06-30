import { countRows } from '../../lib/db.js';
import { chatAvailable } from '../../lib/chat.js';
import { authEnabled } from '../../lib/auth.js';

export async function onRequestGet({ env }) {
  return Response.json({
    ok: true,
    rows: await countRows(env.DB),
    chat: chatAvailable(env),
    auth: authEnabled(env),
  });
}
