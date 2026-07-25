# 웹게임 허브 + 수박게임형 퍼즐 설계서

> 관련 문서: [GAME_CONCEPTS.md](./GAME_CONCEPTS.md) (컨셉 기획서)
>
> 이 문서는 첫 릴리즈(MVP) 범위의 기술 설계를 다룬다. 광고 SDK·재화 상점·관리자 페이지는
> 의도적으로 범위에서 제외하고, 확장 지점만 미리 잡아둔다.

## 1. 목표와 범위

### MVP 목표

- **게임 허브**: 게임 카드 목록이 있는 홈 화면 + 게임별 플레이 화면 + 랭킹 화면
- **첫 게임**: 수박게임형 물리 합성 퍼즐 (컨셉 기획서 Top 7 중 1위)
- **모바일 1순위**: 세로 화면(9:16) 기준 설계, 터치 조작, 저가 안드로이드에서 60fps

### MVP 범위 밖 (확장 지점만 설계)

| 항목 | 미루는 이유 | 확장 지점 |
|---|---|---|
| 리워드 광고 SDK | 트래픽 검증 전엔 수익 없음 | `AdService` 인터페이스 자리만 확보 |
| 재화(코인)·상점 | 광고와 세트로 도입해야 의미 있음 | DB `wallets` 테이블은 스키마만 예약 |
| 관리자 페이지 | 게임 한 자릿수 동안 불필요 | 게임 목록은 코드 내 레지스트리로 관리 |
| PWA·앱화(Capacitor) | 코어 재미 검증 후 | 정적 SPA 구조라 언제든 추가 가능 |

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Vue 3 + Vite + TypeScript | 허브 UI 전담 |
| 게임 렌더링 | Canvas 2D (직접 렌더링) | matter.js 내장 렌더러 미사용 (DPR·스킨 대응) |
| 물리 엔진 | matter.js | 수박게임에만 사용, 게임 모듈 안에 격리 |
| 라우팅 | vue-router | 게임 = 라우트 하나 |
| 상태 관리 | Pinia | 세션·프로필 등 허브 전역 상태만 |
| 백엔드 | Supabase (Auth + Postgres + RLS) | 점수·랭킹·프로필 |
| 운영 배포 | Vercel (`main` 브랜치) | main 배포는 사용자가 직접 수행 |
| 개발 배포 | Cloudflare Pages (`dev` 브랜치 + PR 프리뷰) | 모바일 실기기 테스트 용도 |
| 타입 검증 | vue-tsc | CI 및 로컬 검증 기준 |

### 환경 변수

```
VITE_SUPABASE_URL=       # 환경별로 Vercel/Cloudflare 대시보드에 설정
VITE_SUPABASE_ANON_KEY=
```

- 개발/운영에서 **다른 Supabase 프로젝트**(또는 최소한 다른 스키마)를 쓰는 것을 권장.
  개발 배포에서 만든 테스트 점수가 운영 랭킹에 섞이는 것을 방지.

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────┐
│                  SPA (Vite 빌드)              │
│                                             │
│  허브 셸 (Vue)                                │
│  ├─ 홈(게임 카드 목록) / 랭킹 / 설정             │
│  ├─ GamePlay 페이지  ←  게임 레지스트리          │
│  │        │                                 │
│  │   [GameModule 인터페이스]                   │
│  │        │                                 │
│  └─ games/suika (Canvas + matter.js)         │
│         · 허브를 모름, GameContext로만 통신      │
└──────────────┬──────────────────────────────┘
               │ supabase-js
        ┌──────▼──────┐
        │  Supabase   │  Auth(익명/소셜) · Postgres(RLS) · 랭킹 쿼리
        └─────────────┘
```

핵심 원칙 두 가지:

1. **게임은 허브를 모른다.** 게임 모듈은 `GameContext`(점수 제출 등)만 주입받는다.
   게임 2호부터는 폴더 하나 + 레지스트리 한 줄로 추가된다.
2. **허브는 게임 내부를 모른다.** 허브는 게임을 동적 import로 로드해 DOM 엘리먼트에
   mount할 뿐이다. 게임별 라이브러리(matter.js)는 해당 게임 청크에만 번들된다.

## 4. 프로젝트 구조

```
webGame/
├─ index.html
├─ vite.config.ts
├─ src/
│  ├─ main.ts
│  ├─ app/
│  │  ├─ router.ts            # /, /play/:slug, /ranking/:slug, /settings
│  │  └─ AppLayout.vue        # 모바일 셸 (safe-area, dvh 대응)
│  ├─ pages/
│  │  ├─ HomePage.vue         # 게임 카드 목록 (레지스트리 렌더링)
│  │  ├─ GamePlayPage.vue     # GameModule 로드·mount·unmount
│  │  ├─ RankingPage.vue      # 주간/전체 리더보드
│  │  └─ SettingsPage.vue     # 닉네임, 로그인/로그아웃, 사운드
│  ├─ games/
│  │  ├─ types.ts             # GameModule / GameContext / GameMeta
│  │  ├─ registry.ts          # 게임 목록 (코드로 관리)
│  │  └─ suika/
│  │     ├─ index.ts          # GameModule 구현 (진입점)
│  │     ├─ config.ts         # 과일 티어 테이블, 물리 상수, 보드 크기
│  │     ├─ world.ts          # matter.js 세계 구성·합체 판정
│  │     ├─ renderer.ts       # Canvas 렌더링 (DPR, 과일 표정, 이펙트)
│  │     ├─ input.ts          # Pointer Events → 조준/드롭
│  │     └─ state.ts          # 점수·다음 과일·게임오버 상태 머신
│  ├─ shared/
│  │  ├─ supabase.ts          # 클라이언트 싱글턴
│  │  ├─ auth.ts              # 익명 세션 부트스트랩, 소셜 로그인
│  │  ├─ scores.ts            # 점수 제출·리더보드 조회 API
│  │  └─ ui/                  # 공통 컴포넌트 (버튼, 모달, 게임 카드)
│  └─ styles/
└─ supabase/
   └─ migrations/             # DB 스키마 SQL (버전 관리)
```

## 5. 게임 플러그인 규격

```ts
// src/games/types.ts
export interface GameMeta {
  slug: string            // 'suika' — 라우트·DB game_slug와 동일
  title: string           // '수박 합치기'
  thumbnail: string
  loader: () => Promise<{ default: GameModule }>  // 동적 import
}

export interface GameModule {
  mount(host: HTMLElement, ctx: GameContext): void
  unmount(): void         // 물리 엔진·rAF·이벤트 리스너 정리 책임
}

export interface GameContext {
  submitScore(score: number): Promise<void>  // 게임오버 시 1회 호출
  getBestScore(): Promise<number | null>
  // 확장 지점(MVP 미구현): showRewardAd(placement): Promise<boolean>
}
```

```ts
// src/games/registry.ts — 게임 추가 = 여기 한 줄
export const GAMES: GameMeta[] = [
  { slug: 'suika', title: '수박 합치기', thumbnail: '...', loader: () => import('./suika') },
]
```

## 6. DB 스키마 (Supabase)

```sql
-- profiles: auth.users 1:1
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null default '게스트',
  created_at timestamptz not null default now()
);

-- scores: append-only 플레이 기록 (주간 랭킹은 기간 쿼리로)
create table scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  game_slug text not null,
  score int not null check (score >= 0 and score <= 1000000),
  created_at timestamptz not null default now()
);
create index scores_leaderboard_idx on scores (game_slug, created_at desc, score desc);

-- wallets: 재화 도입 시점을 위한 예약 (MVP에서는 미사용)
```

### RLS 정책

- `profiles`: 본인 row만 insert/update, select는 전체 공개(닉네임 노출용)
- `scores`: 본인 row만 insert (`auth.uid() = user_id`), select 전체 공개, update/delete 금지

### 인증 흐름

- 첫 방문 시 **Supabase 익명 로그인(anonymous sign-in)** 자동 수행 → 가입 없이 점수 저장·랭킹 등재
- 설정에서 소셜 로그인(구글/카카오) 연결 시 익명 계정을 승격(link) → 기록 유지
- 로컬 최고점수는 `localStorage`에도 병행 저장 (오프라인·네트워크 실패 대비)

### 치팅 대비 (MVP 수준)

클라이언트 게임의 한계상 완전한 검증은 불가능하다. MVP에서는
① 점수 상한 check 제약, ② 비정상 제출 빈도 제한(동일 유저 분당 N회),
③ 랭킹 화면에서 이상치 필터만 적용하고, 서버 검증(Edge Function에 플레이 로그 요약
전송)은 트래픽이 생긴 뒤 도입한다.

## 7. 수박게임 상세 설계

### 7.1 보드와 좌표계

- 논리 해상도 **720×1280** 고정. 화면 크기에 맞춰 CSS로 스케일(레터박스), Canvas는
  `devicePixelRatio` 반영해 실제 픽셀로 렌더링
- 통: 논리 좌표 x 55~665, 바닥 y 1114, 위험선 y 390 (목업과 동일 비율)
- 세로 고정. 가로 회전 시 "세로로 돌려주세요" 오버레이

### 7.2 과일 티어 테이블 (`config.ts`)

| 티어 | 이름 | 반지름(논리px) | 합체 점수 | 드롭 등장 |
|---|---|---|---|---|
| 1 | 체리 | 26 | 1 | ○ |
| 2 | 딸기 | 36 | 3 | ○ |
| 3 | 포도 | 42 | 6 | ○ |
| 4 | 오렌지 | 50 | 10 | ○ |
| 5 | 사과 | 62 | 15 | ○ |
| 6 | 배 | 70 | 21 | — |
| 7 | 복숭아 | 78 | 28 | — |
| 8 | 파인애플 | 88 | 36 | — |
| 9 | 멜론 | 98 | 45 | — |
| 10 | 수박 | 115 | 55 | — |
| 11 | (수박+수박) | 소멸 | 100 | — |

- 드롭 과일은 티어 1~5 중 가중치 랜덤(낮은 티어일수록 확률 높게)
- 수박 2개 합체 시 둘 다 소멸 + 보너스 점수 (통 정리 보상)
- 수치는 초기값이며 플레이 테스트로 튜닝한다 — **테이블만 고치면 밸런스 조정이
  끝나도록 로직에 상수를 두지 않는다**

### 7.3 물리 (`world.ts`)

- matter.js `Engine` + 고정 timestep(1/60s), `Runner` 대신 자체 rAF 루프에서 `Engine.update`
- 정적 바디: 좌우 벽, 바닥. 위험선은 물리 바디가 아닌 y좌표 판정
- 과일: `Bodies.circle`, `restitution 0.2`, `friction 0.5` 부근에서 시작해 튜닝
- **합체 판정**: `collisionStart` 이벤트에서 같은 티어 쌍 발견 시
  1. 두 바디 즉시 제거 (한 프레임에 같은 바디가 두 번 합체하지 않도록 처리된 바디 마킹)
  2. 두 중심의 중간점에 다음 티어 생성 (약간의 위쪽 초기 속도로 "튀어나오는" 연출)
  3. 점수 가산 + 이펙트/사운드 큐에 등록

### 7.4 상태 머신 (`state.ts`)

```
READY ──드롭──▶ DROPPING ──착지·쿨다운 0.5s──▶ READY
  │                                            │
  └──────── 위험선 초과 지속 ──▶ GAME_OVER ◀─────┘
```

- **게임오버 판정**: "위험선 위에 있는 과일이 존재하고, 그 과일의 속도가 임계값
  이하(안착 상태)인 프레임이 연속 1.5초" — 떨어지는 중이거나 튀는 중엔 판정하지 않음
- 게임오버 시: 점수 제출 → 최고점 갱신 표시 → 다시하기.
  ("광고 보고 통 비우기"는 AdService 도입 시 이 지점에 붙는다)

### 7.5 입력 (`input.ts`)

- Pointer Events만 사용 (터치/마우스 통합)
- 드래그: 조준 x 이동 + 가이드 점선 표시 / 놓기: 드롭 — 탭만 해도 해당 x에 드롭
- 드롭 쿨다운 중 입력은 조준만 허용
- iOS 사파리 대응: 캔버스 영역 `touch-action: none`, 더블탭 확대·스크롤 방지

### 7.6 렌더링 (`renderer.ts`)

- 배경/통 → 과일(원 + 표정) → 이펙트(합체 파티클, 점수 팝업) → UI(점수, 다음 과일) 순서
- 과일은 색상 원 + 눈·입 벡터 드로잉 (외부 이미지 에셋 0개로 시작 — 스킨 판매
  도입 시 스프라이트로 교체 가능한 구조)
- 파티클·팝업은 오브젝트 풀로 관리 (GC 스파이크 방지)
- `document.hidden` 시 물리·렌더 일시정지 (배터리·백그라운드 대비)

## 8. 배포 파이프라인

```
feature 브랜치 ──PR──▶ dev ──자동 배포──▶ Cloudflare Pages (개발·실기기 테스트)
                        │
                        └─ 검증 후 main 머지 ──▶ Vercel (운영)   ※ main 반영은 사용자가 직접
```

- 브랜치 전략: `feature/*` → `dev` → `main`
- CI(GitHub Actions 또는 각 플랫폼 빌드 훅): `vue-tsc --noEmit` + `vite build` 통과 필수
- Cloudflare Pages의 PR 프리뷰 URL로 모바일 실기기 QA

## 9. 구현 로드맵

| 단계 | 내용 | 검증 기준 |
|---|---|---|
| M1 | 스캐폴딩: Vite+Vue3+TS, 라우터, 레이아웃, 레지스트리, 더미 게임 모듈 | `vue-tsc` 통과, 홈 카드 → 플레이 화면 mount/unmount 왕복에 누수 없음 |
| M2 | 수박게임 코어: 물리·드롭·합체·게임오버 (점수는 로컬만) | 모바일 실기기(개발 배포)에서 한 판 정상 플레이, 60fps |
| M3 | Supabase 연동: 익명 로그인, 점수 제출, 랭킹 페이지, RLS | 두 기기에서 점수 등록 → 랭킹 반영, RLS로 타인 명의 제출 불가 확인 |
| M4 | 폴리싱: 합체 이펙트·사운드·햅틱, 닉네임 설정, 주간 랭킹 | 신규 사용자가 설명 없이 30초 내 플레이 (기획서 UI 기준) |
| 이후 | 리워드 광고 → 재화·상점 → PWA → 두 번째 게임(블록 블라스트) | 단계별 별도 설계 |

각 단계는 독립적으로 `dev`에 머지 가능한 단위로 진행한다.
