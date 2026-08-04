// 토스 로그인 — 인가 코드를 받아 계정에 연결하고, 필요하면 세션을 발급한다.
//
// 앱인토스 미니앱은 토스 로그인만 쓸 수 있어서(toss-docs/login-intro.md) 구글·카카오
// 자리를 이것이 대신한다. 인가 코드 교환은 mTLS 서버 간 통신이라 클라이언트에서
// 할 수 없다 — 이 함수가 그 서버다.
//
// 흐름 (toss-docs/login-develop.md):
//   1. 미니앱이 appLogin()으로 인가 코드를 받아 여기로 보낸다 (유효 10분, 일회성)
//   2. generate-token 으로 AccessToken 교환
//   3. login-me 로 userKey 조회
//   4. userKey가 처음 보는 값이면 지금 쓰던 익명 계정에 묶고(mode: linked),
//      이미 묶인 계정이 있으면 그 계정의 세션을 발급한다(mode: switched)
//
// 필요한 환경 변수 (Vercel → Settings → Environment Variables):
//   TOSS_CLIENT_CERT / TOSS_CLIENT_KEY  콘솔에서 받은 mTLS 인증서·개인키 (PEM 전문)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
import { createDecipheriv } from 'node:crypto'
import { request as httpsRequest } from 'node:https'
import { createClient } from '@supabase/supabase-js'

// Vercel Node 런타임이 넘겨주는 요청·응답. 타입 두 개를 위해 @vercel/node를 받으면
// 빌드 도구 일습이 딸려 오므로, 쓰는 만큼만 적는다
interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  setHeader(name: string, value: string): void
  status(code: number): VercelResponse
  json(body: unknown): void
  end(): void
}

const TOSS_API_HOST = 'apps-in-toss-api.toss.im'
const GENERATE_TOKEN = '/api-partner/v1/apps-in-toss/user/oauth2/generate-token'
const LOGIN_ME = '/api-partner/v1/apps-in-toss/user/oauth2/login-me'

// userKey는 앱 안에서만 유효한 식별자다. 실제로 메일이 오갈 일이 없어야 하므로
// 수신이 불가능한 예약 도메인(RFC 2606)을 쓴다. Supabase가 세션을 발급하려면
// 계정에 이메일이 있어야 해서 두는 값일 뿐이다.
const syntheticEmail = (userKey: number) => `toss-${userKey}@minigame30.invalid`

interface TossResponse {
  resultType?: string
  success?: Record<string, unknown>
  error?: { errorCode?: string; reason?: string }
}

// 앱인토스 API는 mTLS 클라이언트 인증서로만 인증한다 — 별도의 client id/secret이 없다.
// fetch로는 클라이언트 인증서를 붙일 수 없어 node:https를 직접 쓴다.
function callToss(
  path: string,
  init: { method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string },
): Promise<TossResponse> {
  const cert = process.env.TOSS_CLIENT_CERT
  const key = process.env.TOSS_CLIENT_KEY
  if (!cert || !key) throw new Error('TOSS_CLIENT_CERT / TOSS_CLIENT_KEY 환경 변수가 필요합니다')

  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host: TOSS_API_HOST,
        path,
        method: init.method,
        headers: { accept: 'application/json', ...init.headers },
        cert,
        key,
      },
      (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw) as TossResponse)
          } catch {
            reject(new Error(`토스 응답을 읽지 못했습니다 (${res.statusCode})`))
          }
        })
      },
    )
    req.on('error', reject)
    if (init.body) req.write(init.body)
    req.end()
  })
}

// 공통 응답 규격(toss-docs/integration-process.md): resultType을 먼저 본다
function unwrap(response: TossResponse, what: string): Record<string, unknown> {
  if (response.resultType !== 'SUCCESS' || !response.success) {
    const code = response.error?.errorCode ?? 'UNKNOWN'
    throw new Error(`${what} 실패: ${code}`)
  }
  return response.success
}

// login-me의 개인정보 필드는 암호화되어 온다 (toss-docs/login-develop.md 5장).
// AES-256-GCM, 앞 12바이트가 IV, 끝 16바이트가 인증 태그, AAD는 콘솔에서 받은 값.
function decryptField(encrypted: string): string {
  const rawKey = process.env.TOSS_DECRYPT_KEY
  if (!rawKey) throw new Error('TOSS_DECRYPT_KEY 환경 변수가 필요합니다')

  const bytes = Buffer.from(encrypted, 'base64')
  const iv = bytes.subarray(0, 12)
  const tag = bytes.subarray(bytes.length - 16)
  const body = bytes.subarray(12, bytes.length - 16)

  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(rawKey, 'base64'), iv)
  decipher.setAAD(Buffer.from(process.env.TOSS_DECRYPT_AAD ?? 'TOSS'))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}

interface TossUser {
  userKey: number
  // 동의 항목에 이름이 없거나 사용자가 동의하지 않았으면 null이다
  name: string | null
}

async function fetchTossUser(authorizationCode: string, referrer: string): Promise<TossUser> {
  const token = unwrap(
    await callToss(GENERATE_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ authorizationCode, referrer }),
    }),
    'AccessToken 발급',
  )
  const accessToken = token.accessToken
  if (typeof accessToken !== 'string') throw new Error('AccessToken이 응답에 없습니다')

  const me = unwrap(
    await callToss(LOGIN_ME, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    }),
    '사용자 정보 조회',
  )
  const userKey = me.userKey
  if (typeof userKey !== 'number') throw new Error('userKey가 응답에 없습니다')

  // 닉네임을 채우는 용도라, 못 풀어도 로그인 자체를 막을 이유는 없다
  let name: string | null = null
  if (typeof me.name === 'string') {
    try {
      name = decryptField(me.name)
    } catch (error) {
      console.error('toss-login 이름 복호화 실패', error)
    }
  }
  return { userKey, name }
}

function createAdmin(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } })
}

type Admin = ReturnType<typeof createAdmin>

// 다른 기기에서 이미 연동해 둔 계정으로 들어가는 길. Supabase에는 '이 유저의 세션을
// 만들어 달라'는 API가 없어서, 메일을 보내지 않는 매직링크를 만들어 그 토큰만 넘긴다.
async function mintSessionToken(admin: Admin, userId: string, userKey: number): Promise<string> {
  const { data: found, error: lookupError } = await admin.auth.admin.getUserById(userId)
  if (lookupError) throw lookupError

  // 연동 도중에 끊겨 이메일이 비어 있으면 세션을 만들 수 없다. 여기서 채워 준다
  let email = found.user.email
  if (!email) {
    email = syntheticEmail(userKey)
    const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true })
    if (error) throw error
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  return data.properties.hashed_token
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // 미니앱 웹뷰의 origin이 무엇으로 잡히는지 보장할 수 없어 열어 둔다. 쿠키를 쓰지 않고,
  // 일회성 인가 코드와 호출자의 액세스 토큰으로만 판단하므로 origin에 기댈 것이 없다.
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type')
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const { authorizationCode, referrer, accessToken } = (req.body ?? {}) as Record<string, unknown>
  if (typeof authorizationCode !== 'string' || typeof referrer !== 'string') {
    return res.status(400).json({ error: 'missing_authorization_code' })
  }

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return res.status(500).json({ error: 'server_not_configured' })
  }
  const admin = createAdmin(url, serviceRoleKey)

  try {
    const { userKey, name } = await fetchTossUser(authorizationCode, referrer)

    const { data: bound } = await admin
      .from('toss_accounts')
      .select('user_id')
      .eq('user_key', userKey)
      .maybeSingle()

    // 이미 연동해 둔 계정이 있다 = 다른 기기에서 쓰던 계정. 그 계정으로 갈아탄다
    if (bound) {
      const userId = bound.user_id as string
      return res.status(200).json({
        mode: 'switched',
        tokenHash: await mintSessionToken(admin, userId, userKey),
      })
    }

    // 처음 보는 userKey — 지금 쓰던 계정에 묶는다. 호출자의 토큰으로 그 계정을 확인한다
    if (typeof accessToken !== 'string') {
      return res.status(401).json({ error: 'missing_access_token' })
    }
    const { data: caller, error: callerError } = await admin.auth.getUser(accessToken)
    if (callerError || !caller.user) {
      return res.status(401).json({ error: 'invalid_access_token' })
    }

    // 그 계정이 이미 다른 토스 계정에 묶여 있으면 덮어쓰면 안 된다.
    // 한 기기에서 토스 계정을 바꾼 경우라, 새 계정을 따로 만들어 준다
    const { data: callerBound } = await admin
      .from('toss_accounts')
      .select('user_key')
      .eq('user_id', caller.user.id)
      .maybeSingle()

    if (callerBound) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: syntheticEmail(userKey),
        email_confirm: true,
        // name은 클라이언트가 닉네임 초기값으로 쓴다 (auth.ts의 fetchSocialName)
        user_metadata: { toss_user_key: userKey, name },
      })
      if (createError) throw createError
      const { error: insertError } = await admin
        .from('toss_accounts')
        .insert({ user_key: userKey, user_id: created.user.id })
      if (insertError) throw insertError
      return res.status(200).json({
        mode: 'switched',
        tokenHash: await mintSessionToken(admin, created.user.id, userKey),
      })
    }

    // 매핑을 먼저 넣는다 — 이쪽이 실패하면 계정은 건드리지 않은 채로 남는다
    const { error: insertError } = await admin
      .from('toss_accounts')
      .insert({ user_key: userKey, user_id: caller.user.id })
    if (insertError) throw insertError

    const { error: updateError } = await admin.auth.admin.updateUserById(caller.user.id, {
      email: syntheticEmail(userKey),
      email_confirm: true,
      user_metadata: { ...caller.user.user_metadata, toss_user_key: userKey, name },
    })
    if (updateError) throw updateError

    // user_id가 그대로라 클라이언트는 쓰던 세션을 계속 쓰면 된다
    return res.status(200).json({ mode: 'linked' })
  } catch (error) {
    console.error('toss-login', error)
    return res.status(502).json({ error: 'toss_login_failed' })
  }
}
