/**
 * "완료 계약 자동 동기화"를 Notion 자동화 웹훅이 아니라 Worker 스스로의 스케줄로
 * 돌린다. Notion 데이터베이스 자동화의 "정기적으로" 트리거는 공식 문서상 최소
 * 주기가 하루("Every day")라 지연이 너무 크다 — 반면 이 sync는 schedule 문자열로
 * 1분 단위까지 지정 가능하다 (SDK 공식 지원: 최소 "1m", 최대 "7d").
 *
 * 다만 schedule 자체는 "특정 요일 + 특정 시각"(크론 스타일)을 지원하지 않고 단순
 * 반복 주기만 가능하다. 실행 비용(Notion Workers는 실행 1회당 CPU 시간 등으로
 * credits를 소모한다)을 줄이기 위해, schedule은 촘촘하게(기본 1시간) 두되 execute
 * 시작부에서 지금이 목표 요일·시각(기본: 화~토 8시/15시, KST)인지 먼저 확인하고
 * 아니면 API 호출 없이 즉시 종료한다 — 실질적으로 하루 2번만 실제 작업을 한다.
 *
 * 실제 계약 관리 데이터베이스는 절대 `worker.database({type:"attached"})`로 연결하지
 * 않는다 — "배포 시 스키마를 마이그레이션한다"는 동작의 정확한 범위(속성 삭제/재정렬
 * 여부)가 SDK 공식 문서 어디에도 설명돼 있지 않아, 실제 계약 데이터가 든 라이브
 * 데이터베이스에 적용하기엔 위험하다.
 *
 * 대신 이 sync는 최소 스키마의 managed 데이터베이스(WORKER 내부용, "알람시계" 역할)에
 * 연결하고, execute 안에서 sync의 upsert 메커니즘을 전혀 쓰지 않는다(changes는 항상
 * 빈 배열). 실제 작업은 execute에 주입되는 공식 notion 클라이언트로 실제 계약
 * 데이터베이스를 직접 조회(query)·수정(update)한다.
 */
import worker from "../worker.js"
import * as Schema from "@notionhq/workers/schema"
import * as widsign from "../widsign/api.js"
import { syncCompletedContract } from "../widsign/completion.js"
import { getText, getTitle, getNumber, hasFiles } from "../notion/properties.js"
import { notifySlack } from "../notify/slack.js"
import type { Client } from "@notionhq/client"

// ---- 환경변수로 조절 가능한 설정 (기본값은 docs/DATABASE_SCHEMA.md의 속성명과 일치) ----

const TARGET_DATA_SOURCE_ID = process.env.WIDSIGN_SYNC_DATA_SOURCE_ID
const SEND_ID_PROPERTY = process.env.WIDSIGN_SYNC_SEND_ID_PROPERTY || "발송 ID (send_id)"
const FORM_ID_PROPERTY = process.env.WIDSIGN_SYNC_FORM_ID_PROPERTY || "양식 ID (form_id)"
const RECEIVER_ID_PROPERTY = process.env.WIDSIGN_SYNC_RECEIVER_ID_PROPERTY || "수신자 ID"
const PROGRESS_STATUS_PROPERTY = process.env.WIDSIGN_SYNC_PROGRESS_STATUS_PROPERTY || "진행상태"
const PROGRESS_STATUS_COMPLETE_VALUE = process.env.WIDSIGN_SYNC_PROGRESS_STATUS_COMPLETE_VALUE || "완료"
const COMPLETED_FILE_PROPERTY = process.env.WIDSIGN_SYNC_COMPLETED_FILE_PROPERTY || "완료 계약서"

// ---- 안전장치 ----

// 기본값은 반드시 true — 실수로 배포해도 실제 Notion 수정은 일어나지 않는다.
const DRY_RUN = (process.env.WIDSIGN_DRY_RUN ?? "true").toLowerCase() !== "false"
const MAX_UPDATES_PER_RUN = Number.parseInt(process.env.WIDSIGN_MAX_UPDATES_PER_RUN ?? "1", 10)

// ---- 실행 시각 제한 (Notion Workers 실행 비용 절감용) ----
// worker.sync의 schedule은 "30m"/"1h" 같은 단순 반복 주기만 지원하고, 크론처럼
// "특정 요일 + 특정 시각"은 지정할 수 없다. 그래서 schedule 자체는 촘촘한 주기(기본
// 1시간)로 두되, execute 시작부에서 지금이 목표 요일·시각(KST)인지 먼저 확인하고
// 아니면 Notion/위드싸인 API를 전혀 호출하지 않고 즉시 종료한다 — 대부분의 실행은
// 이 확인만 하고 끝나 실행 비용이 거의 들지 않는다.
const TARGET_DAYS_KST = (process.env.WIDSIGN_SYNC_TARGET_DAYS_KST ?? "2,3,4,5,6") // 일=0 ~ 토=6 (기본: 화~토)
  .split(",")
  .map((d) => Number.parseInt(d.trim(), 10))
const TARGET_HOURS_KST = (process.env.WIDSIGN_SYNC_TARGET_HOURS_KST ?? "8,15") // 기본: 오전 8시, 오후 3시
  .split(",")
  .map((h) => Number.parseInt(h.trim(), 10))

export function isTargetWindow(now: Date): boolean {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return TARGET_DAYS_KST.includes(kst.getUTCDay()) && TARGET_HOURS_KST.includes(kst.getUTCHours())
}

// ---- Worker 내부용 "알람시계" 데이터베이스 ----
// 실제 계약 데이터는 전혀 담지 않는다. sync가 스케줄을 갖기 위한 최소 요건일 뿐이다.

const schedulerDb = worker.database("widsignSyncScheduler", {
  type: "managed",
  initialTitle: "위드싸인 동기화 스케줄러 (내부용 — 수정하지 마세요)",
  primaryKeyProperty: "Key",
  schema: {
    properties: {
      Key: Schema.title(),
    },
  },
})

interface CandidatePage {
  pageId: string
  title: string
  sendId: number
  formId: string
  receiverMetaId: string
}

/** 완료 후보(발송 ID 있음 AND 완료 상태 아님)를 전부 조회한다. */
export async function findCandidates(notion: Client): Promise<CandidatePage[]> {
  if (!TARGET_DATA_SOURCE_ID) return []

  const candidates: CandidatePage[] = []
  let cursor: string | undefined
  do {
    const page = await notion.dataSources.query({
      data_source_id: TARGET_DATA_SOURCE_ID,
      page_size: 100,
      start_cursor: cursor,
      filter: {
        and: [
          { property: SEND_ID_PROPERTY, number: { is_not_empty: true } },
          { property: PROGRESS_STATUS_PROPERTY, status: { does_not_equal: PROGRESS_STATUS_COMPLETE_VALUE } },
        ],
      },
    })

    for (const result of page.results) {
      if (!("properties" in result)) continue
      const props = result.properties as Record<string, unknown>

      if (hasFiles(props, COMPLETED_FILE_PROPERTY)) continue // 이미 처리됨

      const sendId = getNumber(props, SEND_ID_PROPERTY)
      const formId = getText(props, FORM_ID_PROPERTY)
      const receiverMetaId = getText(props, RECEIVER_ID_PROPERTY)
      if (sendId === undefined || !formId || !receiverMetaId) continue

      const title = getTitle(props, "계약명") ?? result.id
      candidates.push({ pageId: result.id, title, sendId, formId, receiverMetaId })
    }

    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined
  } while (cursor)

  return candidates
}

worker.sync("widsignScheduledCompletionSync", {
  database: schedulerDb,
  mode: "incremental", // replace 모드는 "이번 사이클에 안 본 레코드 자동 삭제"를 하므로 절대 쓰지 않는다.
  schedule: (process.env.WIDSIGN_SYNC_SCHEDULE as "1h" | "30m" | "1m" | undefined) || "1h",
  execute: async (_state, { notion }) => {
    if (!isTargetWindow(new Date())) {
      return { changes: [], hasMore: false, nextState: undefined } // 목표 요일·시각이 아니면 API 호출 없이 바로 종료
    }

    const summary = { queried: 0, foundComplete: 0, plannedUpdates: 0, actualUpdates: 0, skipped: 0, errors: 0 }

    if (!TARGET_DATA_SOURCE_ID) {
      console.error(
        "[widsignScheduledCompletionSync] WIDSIGN_SYNC_DATA_SOURCE_ID가 설정되지 않아 아무 것도 하지 않습니다.",
      )
      return { changes: [], hasMore: false, nextState: undefined }
    }

    let candidates: CandidatePage[]
    try {
      candidates = await findCandidates(notion)
    } catch (error) {
      console.error(`[widsignScheduledCompletionSync] Notion 조회 실패: ${(error as Error).message}`)
      return { changes: [], hasMore: false, nextState: undefined }
    }
    summary.queried = candidates.length

    const toUpdate: CandidatePage[] = []
    for (const candidate of candidates) {
      try {
        const docs = (await widsign.listDocs({ send_id: candidate.sendId })) as { result: { status: string }[] }
        const status = docs.result[0]?.status
        if (status === "END") {
          toUpdate.push(candidate)
        } else {
          summary.skipped++ // 아직 서명 완료 전 — 다음 주기에 재시도
        }
      } catch (error) {
        summary.errors++
        console.error(
          `[widsignScheduledCompletionSync] 위드싸인 상태 조회 실패 (page ${candidate.pageId}): ${(error as Error).message}`,
        )
      }
    }
    summary.foundComplete = toUpdate.length
    summary.plannedUpdates = toUpdate.length

    if (toUpdate.length > MAX_UPDATES_PER_RUN) {
      const reason =
        `이번 실행에서 수정 예정 건수(${toUpdate.length})가 한도(WIDSIGN_MAX_UPDATES_PER_RUN=${MAX_UPDATES_PER_RUN})를 ` +
        "초과해 아무 것도 수정하지 않았습니다. 예상치 못하게 많은 계약이 한꺼번에 완료 처리 대상이 됐다면 원인을 먼저 확인하세요."
      console.error(`[widsignScheduledCompletionSync] ${reason}`)
      await notifySlack(`⚠️ *완료 동기화 중단*: ${reason}`)
    } else if (DRY_RUN) {
      console.log(
        `[widsignScheduledCompletionSync] DRY RUN — 실제로는 수정하지 않습니다. ` +
          `대상: ${toUpdate.map((c) => c.pageId).join(", ") || "(없음)"}`,
      )
    } else {
      for (const candidate of toUpdate) {
        try {
          await syncCompletedContract(notion, candidate.pageId, candidate.formId, candidate.receiverMetaId, {
            properties: {
              progressStatus: PROGRESS_STATUS_PROPERTY,
              progressStatusCompleteValue: PROGRESS_STATUS_COMPLETE_VALUE,
            },
          })
          summary.actualUpdates++
          await notifySlack(`🎉 *계약 완료*: ${candidate.title}`)
        } catch (error) {
          summary.errors++
          console.error(
            `[widsignScheduledCompletionSync] 완료 처리 실패 (page ${candidate.pageId}): ${(error as Error).message}`,
          )
          await notifySlack(`⚠️ *완료 처리 실패* (${candidate.title}): ${(error as Error).message}`)
        }
      }
    }

    console.log(
      `[widsignScheduledCompletionSync] 요약: 조회 ${summary.queried}건, 완료 발견 ${summary.foundComplete}건, ` +
        `수정 예정 ${summary.plannedUpdates}건, 실제 수정 ${summary.actualUpdates}건, 건너뜀 ${summary.skipped}건, ` +
        `오류 ${summary.errors}건 (DRY_RUN=${DRY_RUN})`,
    )

    // sync의 upsert 메커니즘은 쓰지 않는다 — 실제 데이터베이스 수정은 위에서
    // notion.pages.update로 직접 처리했다. 여기서 changes를 비워 반환하면
    // "알람시계" managed DB에는 아무 것도 쓰이지 않는다.
    return { changes: [], hasMore: false, nextState: undefined }
  },
})
