import { askChat } from '../../lib/chat.js';

export async function onRequestPost({ env, request }) {
  const { question, history } = await request.json().catch(() => ({}));
  if (!question || !String(question).trim()) {
    return Response.json({ error: 'question 이 필요합니다.' }, { status: 400 });
  }
  try {
    const result = await askChat(env, env.DB, String(question).trim(), Array.isArray(history) ? history : []);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: 'AI 응답 생성 중 오류가 발생했습니다.', detail: String(err.message || err) },
      { status: 500 }
    );
  }
}
