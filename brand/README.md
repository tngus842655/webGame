# 브랜드 에셋 (배포되지 않음)

구글·카카오 로그인 버튼 키트에서 **값의 출처가 되는 파일만** 남겼다.
`public/`에 두면 빌드 결과에 그대로 실려 나가므로(작업용 .psd까지 공개된다)
여기로 옮겼고, 앱은 이 파일들을 불러 쓰지 않는다 — 참고용이다.

## 앱에서 실제로 쓰는 것

키트의 완성 버튼 이미지는 **구글은 영어, 카카오는 한국어/영어만** 있다.
이 앱은 13개 언어라 그대로 쓰면 나머지 11개 언어에서 버튼만 외국어가 된다.
그래서 두 브랜드 모두가 허용하는 "직접 만든 버튼 + 공식 심벌" 방식을 쓴다 —
`src/shared/SocialLogo.vue`의 심벌과 `SettingsPage`/`OnboardingFlow`의 버튼.

## 값의 출처

| 값 | 파일 |
|---|---|
| 구글 버튼 테두리 `#747775` | `google-icon-light-pill.svg` |
| 구글 버튼 높이 40px · 알약 모양 | `google-icon-light-pill.svg` (viewBox 0 0 40 40) |
| 구글 완성 버튼 비율 180×40 | `google-button-light-pill.svg` |
| 카카오 노랑 `#FEE500` · 글자 `#191600` 85% | `kakao-login-ko.png` |

## 원본 키트

전체 키트(테마 3종 × 모양 2종 × 배율 4종 × 플랫폼 2종, 129개)는 커밋
`f46641d`에 들어 있다. 다시 필요하면 거기서 꺼내거나 각 사에서 다시 받는다.

- 구글: https://developers.google.com/identity/branding-guidelines
- 카카오: https://developers.kakao.com/docs/latest/ko/kakaologin/design-guide
