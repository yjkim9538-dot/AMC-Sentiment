// .env 로더 — server/.env 가 있으면 process.env 로 로드한다.
// ⚠️ 반드시 다른 모듈(특히 chat.js, db.js)보다 먼저 import 되어야 한다.
//    chat.js 가 import 시점에 ANTHROPIC_API_KEY 를 읽기 때문.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  // Node 22.13+ 내장. .env 없으면 throw → 조용히 무시.
  process.loadEnvFile(join(__dirname, '.env'));
  // (NODE_TLS_REJECT_UNAUTHORIZED / NODE_EXTRA_CA_CERTS 는 node 기동 전에
  //  설정해야 확실히 적용되므로 .env 가 아닌 start.bat 에서 처리한다.)
} catch {
  // .env 미존재 — 환경변수를 직접 설정해 실행하는 경우에도 정상 동작.
}
