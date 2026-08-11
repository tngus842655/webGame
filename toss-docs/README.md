# toss-docs

앱인토스 개발자센터 문서 사본. 개발자센터 도메인이 Claude 세션에서 차단되어 있어, 원문 URL 끝에
`.md`를 붙여 받은 파일을 그대로 보관한다. 각 파일 첫 줄의 frontmatter에 원본 URL이 들어 있다.

| 파일 | 원본 | 내용 |
| --- | --- | --- |
| `login-intro.md` | `/login/intro.md` | 토스 로그인 소개 + **콘솔 설정**(동의 항목, 약관 등록, 연결 끊기 콜백, 복호화 키) |
| `login-develop.md` | `/login/develop.md` | 토스 로그인 개발 가이드 (`appLogin`, 토큰 발급, `login-me`, 복호화, 연결 끊기) |
| `integration-process.md` | `/development/integration-process.md` | **mTLS 인증서 발급**, 방화벽 IP, API 공통 응답 규격, 요청 제한 |
| `promotion-intro.md` | `/promotion/intro.md` | 프로모션(토스포인트) 소개와 콘솔 운영 가이드 |
| `user-hash-key-develop.md` | `/user-hash-key/develop.md` | 사용자 식별키 (`getAnonymousKey` — 프로모션 중복 수령 차단에 사용) |
| `console-mcp.md` | `/prepare/console-mcp.md` | 콘솔 MCP. `toss_login_get_config` 등으로 콘솔 설정을 코드에서 조회·수정할 수 있다 |
| `promotion.md` | `/promotion/develop.md` | 프로모션 개발 가이드 (지급 API, 테스트 코드) |
| `in-app-ad.md` | `/documentation/common/monetization/iaa/intro.md` | 인앱 광고 소개와 콘솔 설정 |
| `interstitial-rewarded-ad.md` | `/documentation/common/monetization/iaa/interstitial-rewarded-ad.md` | **전면형·보상형 광고** 개발 가이드 (`src/shared/ads.ts`가 쓰는 것) |
| `in-app-payment.md` | `/iap/intro.md` | 인앱 결제. 지금은 쓰지 않는다 — 참고용으로만 둔다 |

2026-07-27에 아래 문서는 무관하다고 판단해 삭제했다. 필요해지면 원본 URL에 `.md`를 붙여 다시 받으면 된다.

- `/tossauth/develop.md` — 토스 인증(실명 본인확인)은 이메일을 주지 않는 별도 유료 서비스
- `/user-hash-key/migration.md` — 게임 미니앱 전용 마이그레이션 가이드
- `/bedrock/reference/framework/환경 확인/version.md` — `getTossAppVersion`, 쓰는 곳 없음
