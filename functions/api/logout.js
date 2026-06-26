import { cookieHeader } from '../../lib/auth.js';

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'Set-Cookie': cookieHeader('', 0) },
  });
}
