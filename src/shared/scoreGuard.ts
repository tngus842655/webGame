import { ensureUserId } from './auth'
import {
  clampScore,
  clearPendingScore,
  getLocalBest,
  saveScore,
  stashPendingScore,
  updateLocalBest,
} from './scores'
import { supabase } from './supabase'

// 진행 중 점수 보존 — 게임오버 전에 나가도 기록이 남게 한다.
// 게임 코드는 현재 점수를 돌려주기만 하고(GameModule.currentScore), 저장 시점은 여기서 정한다.
//   1초마다 스냅샷 → localStorage 저널 (앱 강제 종료 대비, 최대 손실 1초)
//   백그라운드 전환·탭 종료 → keepalive 요청으로 즉시 제출
//   뒤로가기(라우터 이탈) → 비동기 제출이 가능하므로 정식 경로로 제출

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const SNAPSHOT_MS = 1000

interface Credentials {
  userId: string
  accessToken: string
}

// 탭이 닫히는 순간에는 비동기로 토큰을 못 가져오므로 미리 확보해둔다
async function loadCredentials(): Promise<Credentials | null> {
  try {
    const userId = await ensureUserId()
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (!accessToken) return null
    return { userId, accessToken }
  } catch {
    return null
  }
}

// keepalive 요청이라 페이지가 닫혀도 전송이 완료된다
function sendKeepalive(creds: Credentials, slug: string, score: number) {
  void fetch(`${SUPABASE_URL}/rest/v1/scores`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${creds.accessToken}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ user_id: creds.userId, game_slug: slug, score }),
  })
    .then((res) => {
      if (res.ok) clearPendingScore(slug)
    })
    .catch(() => {
      // 저널이 남아 다음 실행에 재시도된다
    })
}

/**
 * 진행 중 점수 보존을 시작한다. 반환된 함수를 호출하면 마지막 점수를 제출하고 정리한다.
 * getScore는 게임이 살아 있는 동안만 유효하므로, 게임을 unmount하기 전에 호출해야 한다.
 */
export function startScoreGuard(slug: string, getScore: () => number | null): () => void {
  let creds: Credentials | null = null
  void loadCredentials().then((c) => {
    creds = c
  })

  let latest = 0
  let stopped = false

  // 랭킹은 최고점 기준이라, 기존 기록보다 높을 때만 저장·제출한다 (중복·무의미한 행 방지)
  const worthSending = () => latest > (getLocalBest(slug) ?? 0)

  const snapshot = () => {
    const raw = getScore()
    if (raw === null) return
    const score = clampScore(raw)
    if (score === latest) return
    latest = score
    // 다시하기로 점수가 초기화된 경우까지 포함해, 보존할 가치가 없어지면 저널에서 지운다
    if (worthSending()) stashPendingScore(slug, score)
    else clearPendingScore(slug)
  }

  const timer = window.setInterval(snapshot, SNAPSHOT_MS)

  const flushBeacon = () => {
    if (stopped) return
    snapshot()
    // 자격 증명을 못 얻었으면 저널에 남겨두고 다음 실행에 올린다
    if (!worthSending() || !creds) return
    const score = latest
    updateLocalBest(slug, score) // 같은 점수를 반복 전송하지 않도록 기준을 올린다
    sendKeepalive(creds, slug, score)
  }

  const onVisibility = () => {
    if (document.hidden) flushBeacon()
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', flushBeacon)

  return () => {
    if (stopped) return
    snapshot()
    stopped = true
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', flushBeacon)
    if (worthSending()) void saveScore(slug, latest)
  }
}
