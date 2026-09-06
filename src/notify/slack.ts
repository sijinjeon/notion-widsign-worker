/**
 * Slack Web API(chat.postMessage)로 계약 발송/완료/오류를 알린다. SLACK_BOT_TOKEN
 * 또는 SLACK_CHANNEL_ID가 없으면 조용히 아무 것도 하지 않는다 — 부가 알림이라
 * 실패해도 발송/완료 처리 같은 본 로직을 막지 않는다(항상 별도로 try/catch 처리).
 */
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID

export async function notifySlack(text: string): Promise<void> {
  if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_ID) return
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL_ID, text }),
    })
    const data = (await res.json()) as { ok: boolean; error?: string }
    if (!data.ok) {
      console.error(`[slack] 알림 전송 실패: ${data.error}`)
    }
  } catch (error) {
    console.error(`[slack] 알림 전송 실패: ${(error as Error).message}`)
  }
}

/** Notion 페이지 ID로 어느 워크스페이스에서든 열리는 범용 페이지 URL을 만든다. */
export function notionPageUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`
}

function formatKstTimestamp(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ` +
    `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())} KST`
  )
}

export interface NotifyEventParams {
  /** 메시지 맨 앞 이모지 (성공: ✅ 🎉, 실패/경고: ⚠️) */
  emoji: string
  /** 굵게 표시되는 한 줄 제목, 예: "계약 발송", "발송 실패" */
  headline: string
  /** 어느 자동화가 실행했는지, 예: "계약 발송 자동화", "8시/15시 자동 완료 확인" */
  source: string
  /** 대상 계약명 (있으면 표시) */
  contractTitle?: string
  /** 대상 Notion 페이지 ID — 있으면 바로 열리는 링크로 표시(어디서 실패했는지) */
  pageId?: string
  /** 성공/실패 상세 내용 (사유, 수신자 등) */
  detail?: string
}

/**
 * 언제(시각)·누가(실행 주체)·어디서(Notion 페이지 링크)·무엇을/왜(내용)를 갖춘
 * 구조화된 알림을 보낸다. 낱개 notifySlack(text) 대신 항상 이 함수를 통해 보낸다.
 */
export async function notifyEvent(params: NotifyEventParams): Promise<void> {
  const lines = [
    `${params.emoji} *${params.headline}*`,
    `• 시각: ${formatKstTimestamp(new Date())}`,
    `• 실행: ${params.source}`,
  ]
  if (params.contractTitle) lines.push(`• 계약: ${params.contractTitle}`)
  if (params.pageId) lines.push(`• 페이지: <${notionPageUrl(params.pageId)}|Notion에서 열기>`)
  if (params.detail) lines.push(`• 내용: ${params.detail}`)
  await notifySlack(lines.join("\n"))
}
