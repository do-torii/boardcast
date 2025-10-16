## Farcaster Mini App Shell

미니앱 퍼블리시용 최소 껍데기(project scaffold)입니다. Vite + React 기반이며 Mini App manifest와 `llms-full.txt`가 포함됩니다. 파캐스터 로그인은 Neynar(또는 Farcaster Auth) 연동을 위한 스텁 코드가 들어있습니다.

### 구성

- `public/.well-known/miniapp.json`: Mini App manifest (경로/필드명은 최신 문서 기준으로 조정하세요)
- `public/llms-full.txt`: LLM 안내 파일 (문서의 최신 내용을 복사해 교체)
- `public/icon.svg`: 앱 아이콘 플레이스홀더
- `index.html`, `src/*`: Vite + React 앱
- `src/auth/neynar.ts`: 로그인 흐름 스텁 (데모/실서비스 모드)

### 실행

1) 의존성 설치

```
npm install
```

2) 환경설정

```
cp .env.example .env
# 개발 초기에는 데모 모드 그대로 사용 (VITE_NEYNAR_DEMO=1)
```

3) 개발 서버

```
npm run dev
```

빌드 후 배포:

```
npm run build && npm run preview
```

### Farcaster 로그인 붙이기 (실서비스)

현재 코드는 두 가지 모드를 지원합니다.

- 데모 모드: `VITE_NEYNAR_DEMO=1` → 실제 승인은 없고, 더미 사용자로 로그인 완료됩니다.
- 실서비스 모드: `VITE_NEYNAR_DEMO=0` → 여러분 백엔드를 통해 Neynar(또는 Farcaster Auth) API를 호출해야 합니다.

권장 흐름(서버 사이드):

1. 클라이언트가 `POST /api/neynar/auth/begin` 호출 → 서버가 Neynar에 토큰/승인 URL 요청 → `{ token, approvalUrl }` 반환
2. 클라이언트는 `approvalUrl`을 새 창으로 열어 사용자가 승인
3. 클라이언트가 `POST /api/neynar/auth/poll { token }`로 승인 여부 폴링 → 서버는 승인 완료 시 Farcaster 사용자 프로필을 받아 클라이언트에 반환 (세션 토큰은 서버 보관 권장)

서버 예시(의사 코드):

```ts
// POST /api/neynar/auth/begin
// - Neynar API 키를 서버 환경변수로 보관
// - Neynar Sign-in 시작 엔드포인트 호출 후 token, approvalUrl을 반환

// POST /api/neynar/auth/poll
// - begin에서 받은 token으로 Neynar 상태 조회
// - 승인 완료면 fid, username, pfp 등 사용자 정보를 받아 클라이언트로 전달
```

Farcaster Mini Apps 최신 문서: `https://miniapps.farcaster.xyz/docs/getting-started`
위 문서에 맞춰 `miniapp.json`(또는 요구되는 매니페스트 파일명/경로)과 권한 필드를 업데이트하세요.

### 배포 체크리스트

- `https://YOUR-DOMAIN/.well-known/miniapp.json` 가 공개로 서빙되는지
- `https://YOUR-DOMAIN/llms-full.txt` 가 문서의 최신 내용으로 서빙되는지
- 아이콘/이름/설명 등 메타데이터가 실제 서비스명으로 반영되었는지
- 로그인 공급자(Neynar/Farcaster Auth) 키/콜백/도메인 설정이 맞는지

