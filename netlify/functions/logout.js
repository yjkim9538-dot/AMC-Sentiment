import { cookieHeader } from '../lib/auth.js';

export default async () => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'Set-Cookie': cookieHeader('', 0) },
  });
};

export const config = { path: '/api/logout', method: ['POST'] };
