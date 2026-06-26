@echo off
chcp 65001 >nul
REM AMC 컨센서스 대시보드 - 원클릭 실행 (Windows)
REM 이 파일을 더블클릭하면 서버가 켜집니다. (API 키는 같은 폴더의 .env 에서 읽음)

cd /d "%~dp0"

REM --- 사내망 TLS 검사 인증서 처리 ---
REM 회사 루트 인증서를 받았다면 이 폴더에 "corp-ca.pem" 으로 저장하세요(정식, 권장).
REM 없으면 TLS 검증을 끈 임시 우회로 실행합니다(내부용).
if exist "corp-ca.pem" (
  set "NODE_EXTRA_CA_CERTS=%~dp0corp-ca.pem"
  echo [정보] 회사 인증서 corp-ca.pem 을 사용합니다.
) else (
  set "NODE_TLS_REJECT_UNAUTHORIZED=0"
  echo [주의] corp-ca.pem 없음 - TLS 검증을 끄고 실행합니다(내부용). 정식 운영 시 corp-ca.pem 배치 권장.
)

REM 의존성 미설치 시 자동 설치
if not exist "node_modules" (
  echo [정보] 최초 실행 - 의존성 설치 중...
  call npm install
)

call npm start

echo.
echo 서버가 종료되었습니다. 창을 닫으려면 아무 키나 누르세요.
pause >nul
