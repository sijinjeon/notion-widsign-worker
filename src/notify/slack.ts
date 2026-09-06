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
