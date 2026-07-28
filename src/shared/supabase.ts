import type { SupabaseClient } from '@supabase/supabase-js'

// supabase-js는 gzip 56KB로 이 앱에서 제일 무거운 짐인데, 첫 화면을 그리는 데는
// 필요 없다 — 홈의 최고 기록은 로컬에서 먼저 읽고, 서버는 점수를 올리거나
// 순위를 볼 때부터 쓴다. 그래서 처음 쓰는 순간에 받아 온다.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

type ReadyHook = (client: SupabaseClient) => void

const hooks: ReadyHook[] = []
let client: Promise<SupabaseClient> | null = null

// 클라이언트가 만들어지는 순간 한 번 불린다 (auth.ts의 세션 변경 구독처럼,
// 누가 먼저 부르든 반드시 걸려 있어야 하는 것)
export function whenSupabaseReady(hook: ReadyHook) {
  hooks.push(hook)
  if (client) void client.then(hook)
}

export function getSupabase(): Promise<SupabaseClient> {
  if (!url || !anonKey) {
    return Promise.reject(
      new Error(
        'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경 변수가 필요합니다 (.env.example 참고)',
      ),
    )
  }
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) => {
      const created = createClient(url, anonKey)
      for (const hook of hooks) hook(created)
      return created
    })
  }
  return client
}
