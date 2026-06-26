# AMC 증시 컨센서스 대시보드

군인공제회 증권운용1팀이 위탁운용사(AMC)로부터 **국내·해외 증시 컨센서스**를 수집·누적·열람하기 위한
내부 도구입니다. 운용사에 엑셀 양식을 배포 → 작성된 엑셀을 업로드 → **데이터 저장소(SQLite)에 회차별로 누적** →
대시보드/AI 챗봇으로 열람합니다.

## 구성

```
├─ server/            백엔드 (Express + node:sqlite + Claude API)
│   ├─ server.js        API 라우트 + 정적 프론트 서빙
│   ├─ db.js            SQLite 저장소 (회차별 누적)
│   ├─ chat.js          AI 챗봇 (Claude)
│   └─ seed.js          데모용 샘플 시드 (2개 회차)
├─ public/            프론트엔드 (정적 SPA)
│   ├─ index.html · css/ · js/ · lib/ (SheetJS 벤더링)
└─ data/              SQLite DB (런타임 생성, git 미포함)
```

## 실행 방법

```bash
cd server
npm install
npm run seed     # (선택) 데모용 샘플 2개 회차 적재
npm start        # http://localhost:3000
```

- Node.js **22.13 이상** 필요 (Node 24/26 권장). 내장 `node:sqlite` 사용 — 별도 DB 설치/네이티브 빌드 불필요.
- **AI 챗봇**을 쓰려면 서버 실행 전 환경변수 설정: `ANTHROPIC_API_KEY=...`
  (미설정 시 챗봇만 비활성화되고 나머지 기능은 정상 동작.)
- 백엔드 없이 `public/index.html`을 브라우저에서 바로 열면 **샘플 데이터(오프라인)** 로 화면만 미리볼 수 있습니다.

### Windows — 원클릭 실행 (권장)

매번 환경변수를 입력하지 않도록 `.env` + `start.bat`를 사용합니다.

1. **API 키 저장** — `server\.env.example` 을 같은 폴더에 `.env` 로 복사하고 키 입력:
   ```powershell
   cd server
   Copy-Item .env.example .env
   notepad .env      # ANTHROPIC_API_KEY= 뒤에 실제 키 붙여넣고 저장
   ```
   - `.env` 는 git에 올라가지 않습니다(비밀키 보호).
2. **실행** — `server\start.bat` **더블클릭** (또는 `./start.bat`).
   - 최초 1회는 자동으로 `npm install` 후 실행됩니다.
   - 브라우저에서 http://localhost:3000

> **사내망 TLS 검사 대응:** `start.bat` 는 서버 폴더에 `corp-ca.pem`(회사 루트 인증서)이 있으면
> 이를 신뢰(`NODE_EXTRA_CA_CERTS`)해 안전하게 외부 호출하고, 없으면 임시로 TLS 검증을 끄고 실행합니다.
> 정식 운영 시 IT부서에서 회사 루트 인증서를 받아 `server\corp-ca.pem` 으로 저장하세요(이 파일도 git 미포함).

## 접근 보호 (비밀번호 로그인)

민감 내부 자료이므로 **비밀번호 로그인**으로 전체(화면·데이터·챗봇)를 보호합니다.

- `server\.env` 에 `APP_PASSWORD=원하는비밀번호` 를 설정하면 로그인 게이트가 켜집니다.
  (미설정 시 누구나 접속 가능 — 배포 시 반드시 설정)
- `AUTH_SECRET=` 에 임의의 긴 문자열을 넣어두면 서버 재시작 후에도 로그인 세션이 유지됩니다(비우면 재시작 시 재로그인).
- 첫 접속 시 로그인 화면이 뜨고, 로그인 후 7일간 유지됩니다. 우측 상단 **로그아웃** 버튼으로 해제.

## 사내 상시 서버 배포 (언제든지 접속)

특정 PC가 아니라 **항상 켜져 있는 사내 서버/PC 1대**에서 구동하면, 같은 네트워크의 직원들이 언제든 접속할 수 있습니다.

1. 그 PC에서 위 **원클릭 실행** 설정(.env: `APP_PASSWORD` 포함)을 마칩니다.
2. **방화벽**에서 포트 `3000`(인바운드)을 허용합니다.
3. 다른 직원은 브라우저에서 `http://<서버PC_IP>:3000` 으로 접속 (서버 IP는 `ipconfig` 로 확인).
4. **부팅 시 자동 실행** — `server\install-autostart.bat` 를 **마우스 우클릭 → 관리자 권한으로 실행** (1회).
   - 로그인 시 자동으로 `start.bat`(서버)이 실행됩니다. 해제는 `uninstall-autostart.bat`.
   - 서버 PC는 재부팅 후 **자동 로그인**되도록 설정해 두면 무인 상태에서도 서비스가 떠 있습니다.
   - (대안: `pm2`/`nssm` 으로 서비스 등록도 가능.)

## 어디서든 접속 (Cloudflare Tunnel) — 폰·태블릿·노트북

사내 서버 PC를 **공개 HTTPS 주소 하나로 노출**해 외부 어디서든 접속합니다. 데이터는 PC에 그대로 있고,
방화벽 포트 개방도 필요 없습니다. (Netlify는 백엔드를 못 올려 사용하지 않습니다 — 이 터널 주소가
화면·데이터·AI 챗봇·로그인을 모두 제공합니다.)

> ⚠️ **보안**: 내부 자료를 인터넷에 노출하므로 **강력한 `APP_PASSWORD`** 가 필수이고(터널은 HTTPS 자동 제공),
> **IT·보안부서 승인**을 받는 것을 권장합니다. 추가 보호가 필요하면 Cloudflare Access(이메일 OTP 등)를 더할 수 있습니다.

### 0) cloudflared 설치 (서버 PC, 1회)
```powershell
winget install --id Cloudflare.cloudflared
```
(또는 https://github.com/cloudflare/cloudflared/releases 에서 `cloudflared-windows-amd64.exe` 다운로드)

### A) 빠른 테스트 (계정 불필요)
1. `server\start.bat` 로 서버를 켭니다(이미 켜져 있으면 생략).
2. `server\tunnel.bat` 더블클릭 → 출력에 나오는 `https://xxxxx.trycloudflare.com` 주소를 **폰에서 열고 로그인**.
   - ⚠️ 이 주소는 **실행할 때마다 바뀝니다**. 상시 사용은 아래 B) 고정 주소를 쓰세요.

### B) 고정 주소(상시 운영) — Cloudflare 대시보드 + 도메인

가장 쉬운 방법은 **Cloudflare Zero Trust 대시보드**에서 터널을 만들고 토큰 한 줄로 서비스 설치하는 것입니다
(config 파일 편집 불필요, 서비스로 등록되어 **부팅 시 자동 실행**).

1. **Cloudflare 무료 계정** 생성 → https://dash.cloudflare.com
2. **도메인 준비** — 없으면 대시보드 **Domain Registration → Register Domains** 에서 신규 등록(자동으로 Cloudflare에 연결).
   - 이미 다른 곳에서 산 도메인이면 **Websites → Add a site** 로 추가하고 안내대로 네임서버를 Cloudflare로 변경.
3. **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared** → 터널 이름(예: `amc`) 입력 → 저장.
4. 화면에 나오는 **Windows 설치 명령**(토큰 포함)을 서버 PC의 **관리자 PowerShell**에 붙여넣어 실행:
   ```powershell
   cloudflared service install eyJ...(토큰)...
   ```
   → 터널이 Windows 서비스로 설치되어 자동 실행됩니다.
5. 같은 터널의 **Public Hostname** 탭 → **Add a public hostname**:
   - Subdomain: `amc` / Domain: 내 도메인 / Path: 비움
   - Service: **`HTTP`** , URL **`localhost:3000`** → 저장.
6. 완료 → **`https://amc.내도메인`** 으로 폰·태블릿·노트북 어디서든 접속(로그인 필요).

> 추가 보호(선택): Zero Trust → Access 로 이메일 OTP 등 2차 인증을 얹을 수 있습니다.
> 공개 게재 전 `APP_PASSWORD` 를 반드시 강한 값으로 변경하세요.

## 클라우드 상시 배포 (Cloudflare Pages + D1) — 내 PC 없이 항상 접속

내 PC를 켜두지 않아도 **항상 접속**되고, **git에 푸시(업데이트)할 때만** 사이트가 바뀌는 방식입니다.
백엔드는 Cloudflare Pages Functions(`functions/`), 데이터는 Cloudflare D1(SQLite), 챗봇은 Worker에서
Anthropic API 호출로 동작합니다. **무료 `*.pages.dev` 주소**가 제공되어 도메인 없이도 어디서든 접속됩니다.

> ⚠️ 이 방식은 데이터가 **Cloudflare(D1)** 에 저장됩니다(사내 PC 아님). 민감 자료이므로 IT·보안부서 검토 권장.
> 데이터를 사내에 두려면 위의 "사내 상시 서버 + Cloudflare Tunnel" 방식을 쓰세요(둘은 택일).

### 1) D1 데이터베이스 생성 + 초기화
Cloudflare 대시보드 → **Workers & Pages → D1 → Create** → 이름 `amc-consensus`.
스키마·데모데이터 적용(둘 중 하나):
- 대시보드 D1 콘솔에 `schema.sql` → `seed.sql` 내용을 차례로 붙여넣어 실행, 또는
- CLI: `npx wrangler d1 execute amc-consensus --remote --file=./schema.sql` 그리고 `--file=./seed.sql`
  - (실데이터만 쓰려면 `seed.sql`(데모) 적용은 생략)

### 2) Pages 프로젝트 생성 (Git 연결 — 권장)
**Workers & Pages → Create → Pages → Connect to Git** → 이 저장소 선택.
- **Build command**: 비움 / **Build output directory**: `public` (Functions 는 `functions/` 자동 인식)

### 3) 바인딩·비밀값 설정 (Pages 프로젝트 → Settings)
- **Functions → D1 database bindings**: 변수명 `DB` → `amc-consensus` 연결 (Production·Preview 모두).
- **Environment variables (Secret)**:
  - `APP_PASSWORD` = 강한 비밀번호(필수)
  - `AUTH_SECRET` = 임의의 긴 문자열(로그인 세션 유지)
  - `ANTHROPIC_API_KEY` = 챗봇용(없으면 챗봇만 비활성)
  - `ANTHROPIC_MODEL` = (선택) 기본 `claude-opus-4-8`
- 저장 후 **Redeploy**.

### 4) 접속 / 운영
- 발급된 **`https://<프로젝트>.pages.dev`** 로 폰·태블릿·노트북 어디서든 접속 → 로그인.
- **업데이트**: 이 저장소에 push 하면 Pages가 자동 재배포(데이터는 D1에 그대로 유지).
- 고정 도메인 원하면 Pages → **Custom domains** 에서 연결(선택).

> CLI 배포 대안: `npx wrangler pages deploy public` (먼저 `npx wrangler login`).
> 비밀값은 `npx wrangler pages secret put APP_PASSWORD` 등으로도 설정 가능.

## 사용 흐름

1. **엑셀 양식 다운로드** (`엑셀 양식` 버튼) → 운용사에 배포.
2. 운용사가 작성 → **엑셀 업로드**(여러 운용사 파일을 한 번에 다중 선택 가능) → **회차 라벨 입력**(수령 시점이 비정기적이므로 날짜 기반 권장, 기본값=오늘 날짜). 선택한 파일들이 모두 같은 회차로 누적되고, **업로드 결과 요약**(저장된 운용사·신규/갱신)이 표시됩니다.
3. 저장은 **append-only(이력 보존)** — 같은 회차·운용사를 다시 올리면 화면은 **최신본**을 보여주되 과거 제출은 서버에 그대로 보존됩니다(AI 챗봇으로 과거 데이터 조회 가능).
4. 헤더의 **회차 선택**으로 회차를 전환하며 열람. **회차 추이** 탭에서 회차 간 방향성 변화 비교.
5. **AI 챗봇**으로 누적된 과거 데이터를 자연어로 검색.

## 화면

| 탭/요소 | 내용 |
| --- | --- |
| 국내 통합 | 방향성 분포·목표밴드 평균 + **운용사 의견 종합(긍정·부정)** + 운용사별 전망 + 종목 매수/매도 집계 |
| 국내 운용사별 | 운용사 상세(방향성·밴드·Pro/Con) + 종목 Top Pick |
| 해외 통합 | 시장 × 운용사 방향성 매트릭스 (미국/일본/베트남/인도/ACWI/선진국) |
| 해외 운용사별 | 운용사별 6개 시장 카드 |
| 회차 추이 | 회차별 국내·해외 방향성 분포 추이 |
| AI 챗봇 | 누적 데이터에 대한 자연어 질의응답 (Claude) |

## 엑셀 양식 (작성안내 + 3개 시트)

배포용 양식은 가독성·작성 편의를 위해 **헤더 서식, 열 너비, 틀 고정, 드롭다운(방향성/의견), 작성안내 시트**가
적용된 정적 파일입니다: `public/templates/AMC_컨센서스_양식.xlsx` (헤더의 `엑셀 양식` 버튼으로 다운로드).
양식 재생성: `cd server && python3 build_template.py` (openpyxl 필요).

- **국내시장**: `운용사명 · 작성일 · 방향성 · KOSPI 목표 하단 · KOSPI 목표 상단 · Pro (긍정사유) · Con (부정사유)`
- **국내종목**: `운용사명 · 종목명 · 의견 · 사유` (운용사 자율 선정 Top Pick)
- **해외**: `운용사명 · 작성일 · 시장 · 기준지수 · 방향성 · 목표 하단 · 목표 상단 · Pro (긍정사유) · Con (부정사유)`

값 도메인: 방향성 = `강세/중립/약세`, 의견 = `매수/중립/매도`. (헤더 표기가 공백/밑줄로 달라도 업로드 시 자동 인식)

## API 요약

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/health` | 상태·저장 건수·챗봇 가용 여부 |
| GET | `/api/periods` | 회차 목록(+응답 운용사 수) |
| GET | `/api/consensus?period=` | 해당 회차 통합 컨센서스 |
| GET | `/api/trend` | 회차별 방향성 추이 |
| POST | `/api/submissions` | 회차+운용사별 제출 저장(업서트) |
| POST | `/api/chat` | AI 챗봇 질의 |

## 기술 메모

- DB: `node:sqlite`(내장). 저장 단위 = (회차 × 운용사) 1행, `UNIQUE(period, amc)` 업서트.
- AI: `@anthropic-ai/sdk`, 모델 기본값 `claude-opus-4-8` (환경변수 `ANTHROPIC_MODEL`로 변경 가능).
  누적 데이터를 컨텍스트로 전달하고 데이터 근거 답변만 하도록 시스템 프롬프트로 제약.
- 프론트는 차트 라이브러리 없이 CSS 분포 바로 시각화. 백엔드 미감지 시 샘플 데이터로 자동 폴백.

## 향후 확장 (참고)

운용사 제출용 별도 포털/이메일 연동, 권한 관리, PDF/이미지 내보내기, 종목 식별자(코드) 표준화 등.
