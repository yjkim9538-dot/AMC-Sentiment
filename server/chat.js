// AI 챗봇 — 누적된 과거 컨센서스 데이터에 대한 질의응답.
// Claude API(Anthropic)를 사용한다. ANTHROPIC_API_KEY 가 없으면 안내 메시지를 반환한다.
import Anthropic from '@anthropic-ai/sdk';
import { getAllForContext } from './db.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

const hasKey = !!process.env.ANTHROPIC_API_KEY;
const client = hasKey ? new Anthropic() : null; // ANTHROPIC_API_KEY 를 환경에서 읽음

const SYSTEM = `당신은 군인공제회 증권운용1팀의 리서치 보조 AI입니다.
아래 <데이터>는 위탁운용사(AMC)들이 제출한 국내·해외 증시 컨센서스의 누적 기록입니다(여러 회차 포함).
사용자의 질문에 대해 이 데이터에 근거해서만 한국어로 간결하고 정확하게 답하세요.
- 숫자(목표밴드, 운용사 수 등)는 데이터에서 직접 집계해 제시하세요.
- 운용사별 의견을 비교하거나, 회차 간 변화(추이)를 물으면 회차를 명시해 설명하세요.
- 데이터에 없는 내용은 추측하지 말고 "해당 정보는 제출된 데이터에 없습니다"라고 답하세요.
- 답변 끝에 근거가 된 운용사/회차를 간단히 덧붙이면 좋습니다.`;

export function chatAvailable() {
  return hasKey;
}

export async function askChat(question, history = []) {
  if (!client) {
    return {
      available: false,
      answer:
        'AI 챗봇을 사용하려면 서버에 ANTHROPIC_API_KEY 환경변수를 설정해야 합니다. ' +
        '(키 없이도 대시보드의 모든 보기와 데이터 누적 기능은 정상 동작합니다.)',
    };
  }

  const dataset = getAllForContext();
  const dataBlock = JSON.stringify(dataset);

  // 캐시 친화: 안정적인 시스템+데이터를 앞에 두고, 가변 질문을 뒤에 둔다.
  const messages = [
    {
      role: 'user',
      content: `<데이터>\n${dataBlock}\n</데이터>\n\n위 데이터를 기준으로 답하세요.`,
      // 큰 데이터 블록을 캐시
    },
    { role: 'assistant', content: '네, 제출된 컨센서스 데이터를 확인했습니다. 질문해 주세요.' },
    ...history.flatMap((h) => [
      { role: 'user', content: h.q },
      { role: 'assistant', content: h.a },
    ]),
    { role: 'user', content: question },
  ];

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages,
  });

  const answer = resp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return { available: true, answer, model: resp.model };
}
