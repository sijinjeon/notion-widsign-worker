/**
 * 위드싸인 API v2 클라이언트.
 * 인증 흐름: GET /token (x-api-id, x-api-key) -> access_token (10분 유효, x-access-token 헤더로 사용)
 * https://apidocs.widsign.com/reference/get_token
 */

// @notionhq/workers doesn't publicly export its JSONValue type, so it's redeclared here
// to match dist/types.d.ts — tool() results must satisfy this shape.
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue }

const BASE_URL = "https://api.widsign.com/v2"

// 토큰은 10분간 유효 — 30초 여유를 두고 캐시한다.
const TOKEN_TTL_MS = 9.5 * 60 * 1000

let cachedToken: { token: string; expiresAt: number } | null = null

interface TokenResponse {
  svc_owner_id: number
  access_token: string
}

async function fetchAccessToken(): Promise<string> {
  const apiId = process.env.WIDSIGN_API_ID
  const apiKey = process.env.WIDSIGN_API_KEY
  if (!apiId || !apiKey) {
    throw new Error(
      "WIDSIGN_API_ID / WIDSIGN_API_KEY 환경변수가 설정되지 않았습니다. `ntn workers env push`로 배포하세요.",
    )
  }

  const res = await fetch(`${BASE_URL}/token`, {
    method: "GET",
    headers: { "x-api-id": apiId, "x-api-key": apiKey },
  })
  if (!res.ok) {
    throw new Error(`위드싸인 토큰 발급 실패 (${res.status}): ${await res.text()}`)
  }
  const data = (await res.json()) as TokenResponse
  return data.access_token
}

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token
  }
  const token = await fetchAccessToken()
  cachedToken = { token, expiresAt: now + TOKEN_TTL_MS }
  return token
}

/** 위드싸인 API에 GET 요청을 보낸다. 인증 토큰 발급/갱신을 자동 처리한다. */
export async function widsignGet<T extends JSONValue = JSONValue>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const token = await getAccessToken()
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  // 문서상 엔드포인트별로 x-api-key 또는 x-access-token 중 요구하는 헤더가 달라
  // (예: /service/credit 은 x-api-key 필수), 두 헤더를 모두 보낸다.
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-access-token": token,
      "x-api-key": process.env.WIDSIGN_API_KEY ?? "",
    },
  })
  if (!res.ok) {
    throw new Error(`위드싸인 API 요청 실패 ${path} (${res.status}): ${await res.text()}`)
  }
  return (await res.json()) as T
}

/** 위드싸인 API에서 바이너리 파일을 받아 base64 문자열로 반환한다. */
export async function widsignGetBinary(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<{ base64: string; contentType: string | null }> {
  const token = await getAccessToken()
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-access-token": token,
      "x-api-key": process.env.WIDSIGN_API_KEY ?? "",
    },
  })
  if (!res.ok) {
    throw new Error(`위드싸인 API 요청 실패 ${path} (${res.status}): ${await res.text()}`)
  }
  const buffer = await res.arrayBuffer()
  return {
    base64: Buffer.from(buffer).toString("base64"),
    contentType: res.headers.get("content-type"),
  }
}

/** 위드싸인 API에서 바이너리 파일을 ArrayBuffer로 받는다 (Worker 내부 처리용, 크기 제한 없음). */
export async function widsignGetArrayBuffer(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<ArrayBuffer> {
  const token = await getAccessToken()
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-access-token": token,
      "x-api-key": process.env.WIDSIGN_API_KEY ?? "",
    },
  })
  if (!res.ok) {
    throw new Error(`위드싸인 API 요청 실패 ${path} (${res.status}): ${await res.text()}`)
  }
  return res.arrayBuffer()
}

/** 위드싸인 API에 POST 요청을 보낸다. 인증 토큰 발급/갱신을 자동 처리한다. */
export async function widsignPost<T extends JSONValue = JSONValue>(
  path: string,
  body: Record<string, JSONValue>,
): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "x-access-token": token,
      "x-api-key": process.env.WIDSIGN_API_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`위드싸인 API 요청 실패 ${path} (${res.status}): ${await res.text()}`)
  }
  return (await res.json()) as T
}
