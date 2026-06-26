// AI 챗봇 — 누적된 과거 컨센서스 데이터에 대한 질의응답.
// Claude API(Anthropic)를 사용한다. ANTHROPIC_API_KEY 가 없으면 안내 메시지를 반환한다.
import Anthropic from '@anthropic-ai/sdk';
import { getAllForContext } from './db.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

const hasKey = !!process.env.ANTHROPIC_API_KEY;
const client = hasKey ? new Anthropic() : null; // ANTHROPIC_API_KEY 를 환경에서 읽음

const SYSTEM = `당신은 군인공제회 증권운용1팀의 리서치 보조 AI입니다.
아래 <데이터>는 위탁운용사(AMC)들이 제출한 국내·해외 증시 컨센서스의 누적 기록입니다(여러 회차 포함).
오직 이 데이터에만 근거해 한국어로 답하세요. 데이터 밖의 일반 지식이나 추측은 쓰지 마세요.

[데이터 구조 안내]
- 각 항목은 회차(period)·운용사(amc) 단위입니다.
- domesticMarket: 국내 시장 전망 { view(강세/중립/약세), targetLow~targetHigh(KOSPI 목표밴드), pro, con }
- domesticStocks: 국내 종목 의견 [{ stock, opinion(매수/중립/매도), reason }]
- overseas: 해외 시장 전망 [{ market(미국/일본/베트남/인도/ACWI/선진국), view, targetLow~targetHigh, pro, con }]

[답변 형식]
- 결론을 먼저 한 문장으로 제시한 뒤 근거를 적으세요.
- 여러 운용사·종목·시장을 나열/비교할 때는 간결한 목록(또는 표 형태)으로 정리하세요.
- 수치(운용사 수, 목표밴드 평균, 분포 등)는 데이터에서 직접 세어 제시하세요.
- 회차 간 변화(추이)를 물으면 비교 대상 회차를 명시하세요.
- 답변 끝줄에 "근거: <운용사/회차>" 형태로 출처를 표기하세요.
- 데이터에 없으면 추측 없이 "제출된 데이터에 없습니다"라고 답하세요.
- 장황한 서론 없이 핵심만 간결하게.`;

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
