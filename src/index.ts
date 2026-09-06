import { j } from "@notionhq/workers/schema-builder"
import JSZip from "jszip"
import worker from "./worker.js"
import * as widsign from "./widsign/api.js"
import {
  buildSendItems,
  extractReceiverValues,
  CONTRACT_TYPE_FORM_ID_MAP,
  type DbFieldKey,
  type DocDetailResult,
} from "./widsign/fieldMapping.js"
import { attachSignedDocument, syncCompletedContract } from "./widsign/completion.js"
import { numberToKoreanWon, formatDate, formatDateRange } from "./notion/format.js"
import {
  getTitle,
  getText,
  getEmail,
  getPhone,
  getSelect,
  getStatus,
  getNumber,
  getDate,
  hasFiles,
  richText,
} from "./notion/properties.js"
import { notifyEvent } from "./notify/slack.js"
// 부수효과 목적의 import: 스케줄된 완료 계약 동기화 sync를 등록한다.
import "./sync/scheduledCompletionSync.js"

export default worker

// Example agent tool that returns a greeting
// Delete this when you're ready to start building your own tools.
worker.tool("sayHello", {
  title: "Say Hello",
  description: "Returns a friendly greeting for the given name.",
  schema: j.object({
    name: j.string().describe("The name to greet."),
  }),
  execute: ({ name }) => `Hello, ${name}!`,
})

// ---- 위드싸인(WidSign) 연동 ----
// 계약 발송(widsignSendContract)은 2026-09-01 사용자 승인 후 구현했다.
// 재발송/취소 등 나머지 실제 계약에 영향을 주는 기능은 별도 승인 전까지 구현하지 않았다.

worker.tool("widsignCheckCredit", {
  title: "위드싸인 잔여 발송건수 조회",
  description: "위드싸인 계정의 잔여 발송 크레딧을 조회합니다.",
  schema: j.object({}),
  execute: () => widsign.getCredit(),
})

worker.tool("widsignListTemplates", {
  title: "위드싸인 템플릿 목록 조회",
  description: "등록된 위드싸인 전자계약 템플릿(폼) 목록을 조회합니다.",
  schema: j.object({
    page: j.number().describe("페이지 번호 (기본 1)").nullable(),
    title: j.string().describe("템플릿 제목 검색어").nullable(),
  }),
  execute: ({ page, title }) =>
    widsign.listForms({ page: page ?? undefined, title: title ?? undefined }),
})

worker.tool("widsignListContracts", {
  title: "위드싸인 계약서 목록 조회",
  description: "발송된 위드싸인 계약서 목록을 상태별로 조회합니다.",
  schema: j.object({
    page: j.number().describe("페이지 번호 (기본 1)").nullable(),
    status: j
      .enum("SEND", "WRITING", "CANCEL", "REJECT", "EXPIRATION", "END")
      .describe("계약 상태 필터")
      .nullable(),
  }),
  execute: ({ page, status }) =>
    widsign.listDocs({ page: page ?? undefined, status: status ?? undefined }),
})

worker.tool("widsignTemplateDetail", {
  title: "위드싸인 템플릿 상세(필드 목록) 조회",
  description: "템플릿에 배치된 입력 필드(이름, 타입, ID)를 조회합니다. 계약 발송 시 항목 사전입력값(items) 매핑을 만들 때 사용합니다.",
  schema: j.object({
    form_id: j.string().describe("템플릿 ID (양식 ID)"),
  }),
  execute: ({ form_id }) => widsign.getFormDetail(form_id),
})

worker.tool("widsignServiceGroups", {
  title: "위드싸인 서비스 그룹 목록 조회",
  description: "계정에 등록된 그룹(하위 조직) 목록을 조회합니다. 템플릿이 다른 그룹에 속해 있어 안 보일 때 진단용으로 사용합니다.",
  schema: j.object({}),
  execute: () => widsign.listServiceGroups(),
})

worker.tool("widsignServiceMembers", {
  title: "위드싸인 서비스 멤버 목록 조회",
  description: "계정에 등록된 멤버(발송 계정) 목록을 조회합니다.",
  schema: j.object({}),
  execute: () => widsign.listServiceMembers(),
})

worker.tool("widsignSendContract", {
  title: "위드싸인 계약서 실제 발송",
  description:
    "계약서를 실제로 발송합니다. 이메일/문자가 실제로 발송되고 위드싸인 크레딧을 소모하는 되돌릴 수 없는 동작입니다. " +
    "form_id에 매핑된 필드(fieldMapping.ts의 FORM_ITEM_MAP.fields)가 있으면 내용 필드 값을 해당 위드싸인 템플릿 필드에 자동으로 채워 넣습니다. " +
    "일부 템플릿(예: 전시 참여 작가 v2)은 계약상대자명/주소/대표자명/입금계좌 정보를 수신자가 서명 중 직접 입력하도록 " +
    "설계되어 있어(receiverFields), 그 필드는 여기 입력해도 무시됩니다 — 계약 완료 후 widsignReceiverInputValues로 조회하세요.",
  schema: j.object({
    form_id: j.string().describe("발송할 템플릿 ID"),
    receiver_name: j.string().describe("수신자 이름"),
    receiver_email: j.string().describe("수신자 이메일"),
    receiver_mobile: j.string().describe("수신자 휴대폰 번호 (하이픈 없이, 예: 01012345678)").nullable(),
    send_type: j.enum("SAMETIME", "SEQUENTIAL").describe("전송 방식").nullable(),
    계약명: j.string().describe("계약서 제목이자 Notion DB의 계약명").nullable(),
    계약기간: j.string().describe("계약 효력 기간").nullable(),
    계약금액: j.string().describe("계약 금액 (예: 일백만원정(₩1,000,000원))").nullable(),
    작성일자: j.string().describe("계약서 작성일").nullable(),
    계약상대자: j.string().describe("계약상대자 성명/상호").nullable(),
    계약상대자_주소: j.string().describe("계약상대자 주소").nullable(),
    전시명: j.string().describe("전시 제목").nullable(),
    전시기간: j.string().describe("전시 기간").nullable(),
    설치일정: j.string().describe("작품 설치 예정일").nullable(),
    전시장소: j.string().describe("전시 장소").nullable(),
    입금은행: j.string().describe("계약금 입금 은행").nullable(),
    계좌번호: j.string().describe("계약금 입금 계좌번호").nullable(),
    예금주: j.string().describe("계약금 입금 계좌 예금주").nullable(),
  }),
  execute: (input) => {
    const row: Partial<Record<DbFieldKey, string>> = {}
    const set = (key: DbFieldKey, value: string | null) => {
      if (value !== null) row[key] = value
    }
    set("계약명", input.계약명)
    set("계약기간", input.계약기간)
    set("계약금액", input.계약금액)
    set("작성일자", input.작성일자)
    set("계약상대자", input.계약상대자)
    set("계약상대자 주소", input.계약상대자_주소)
    set("전시명", input.전시명)
    set("전시기간", input.전시기간)
    set("설치일정", input.설치일정)
    set("전시장소", input.전시장소)
    set("입금은행", input.입금은행)
    set("계좌번호", input.계좌번호)
    set("예금주", input.예금주)

    const items = buildSendItems(input.form_id, row)

    return widsign.sendForm({
      form_id: input.form_id,
      title: input.계약명 ?? "제목 없음",
      send_type: input.send_type ?? "SAMETIME",
      receiver_list: [
        {
          name: input.receiver_name,
          email: input.receiver_email,
          mobile: input.receiver_mobile ?? undefined,
        },
      ],
      items,
    })
  },
})

worker.tool("widsignContractDetail", {
  title: "위드싸인 계약서 상세 조회",
  description: "특정 수신자의 계약 상세(서명 진행 상태 포함)를 조회합니다.",
  schema: j.object({
    receiver_meta_id: j.string().describe("수신자 계약 ID (doc 목록 조회 결과의 receiver_list 값)"),
  }),
  execute: ({ receiver_meta_id }) => widsign.getDocDetail(receiver_meta_id),
})

worker.tool("widsignInspectDocumentZip", {
  title: "위드싸인 완료 계약서 zip 구조 진단",
  description: "완료 계약서 zip 안에 어떤 파일들이 들어있는지 이름/크기만 나열합니다 (내용은 받지 않음).",
  schema: j.object({
    receiver_meta_id: j.string().describe("수신자 계약 ID"),
  }),
  execute: async ({ receiver_meta_id }) => {
    const buffer = await widsign.downloadDocRaw(receiver_meta_id)
    const zip = await JSZip.loadAsync(buffer)
    const entries = Object.values(zip.files).map((f) => ({
      name: f.name,
      dir: f.dir,
    }))
    return { totalZipBytes: buffer.byteLength, entries }
  },
})

worker.tool("widsignAttachSignedDocument", {
  title: "위드싸인 완료 계약서를 Notion에 첨부",
  description:
    "완료된 계약서(contract.pdf)와 감사추적인증서(certificate.pdf)를 위드싸인에서 받아 " +
    "Notion 페이지의 '완료 계약서'/'감사추적인증서' 파일 속성에 첨부합니다.",
  schema: j.object({
    page_id: j.string().describe("Notion 페이지 ID"),
    receiver_meta_id: j.string().describe("수신자 계약 ID"),
  }),
  execute: ({ page_id, receiver_meta_id }, { notion }) => attachSignedDocument(notion, page_id, receiver_meta_id),
})

worker.tool("widsignDownloadDocument", {
  title: "위드싸인 완료 계약서 다운로드",
  description: "완료된 계약서 사본(PDF+감사추적인증서, zip)을 base64로 받아옵니다.",
  schema: j.object({
    receiver_meta_id: j.string().describe("수신자 계약 ID"),
  }),
  execute: async ({ receiver_meta_id }) => {
    const { base64, contentType } = await widsign.downloadDoc(receiver_meta_id)
    return { base64, contentType, byteLength: Buffer.from(base64, "base64").length }
  },
})

worker.tool("widsignReceiverInputValues", {
  title: "위드싸인 수신자 입력값 조회",
  description:
    "계약이 완료된 뒤 수신자가 직접 입력한 값(계약상대자명/주소/대표자명/입금계좌 등)을 " +
    "Notion DB 속성명 기준으로 정리해 반환합니다. fieldMapping.ts의 receiverFields 매핑을 사용합니다.",
  schema: j.object({
    form_id: j.string().describe("계약에 사용된 템플릿 ID"),
    receiver_meta_id: j.string().describe("수신자 계약 ID"),
  }),
  execute: async ({ form_id, receiver_meta_id }) => {
    const detail = (await widsign.getDocDetail(receiver_meta_id)) as unknown as DocDetailResult
    return extractReceiverValues(form_id, detail)
  },
})

// ---- 웹훅: 진행상태를 '발송'으로 바꾸면 위드싸인으로 자동 발송 ----
// worker.automation은 이 계정에서 아직 활성화되지 않은 기능(private alpha)이라 배포가
// 거부된다. 대신 Notion 데이터베이스 자체의 "자동화 → 웹훅 보내기" 액션으로 이 웹훅을
// 호출하도록 설정한다. 웹훅 URL은 `ntn workers webhooks list`로 확인하고, Notion
// 자동화의 웹훅 body 템플릿은 반드시 {"page_id": "{{Page ID}}"} 형태로 지정해야 한다
// (body 안의 다른 값은 신뢰하지 않고 page_id로 페이지를 다시 조회해 최신 상태를 쓴다).
worker.webhook("widsignSendOnStatusChange", {
  title: "위드싸인 계약 자동 발송",
  description:
    "전자계약 관리 DB에서 진행상태를 '발송'으로 변경하면 위드싸인으로 계약서를 자동 발송합니다. " +
    "이미 발송 ID가 있는 행은 중복 발송을 방지하기 위해 건너뜁니다. " +
    "Notion 자동화의 웹훅 body는 {\"page_id\": \"{{Page ID}}\"} 형태여야 합니다.",
  execute: async (events, { notion }) => {
    for (const event of events) {
      const pageId = event.body.page_id
      if (typeof pageId !== "string" || !pageId) continue

      const page = await notion.pages.retrieve({ page_id: pageId })
      if (!("properties" in page)) continue
      const props = page.properties as Record<string, unknown>

      if (getStatus(props, "진행상태") !== "발송") continue
      if (getNumber(props, "발송 ID (send_id)") !== undefined) continue // 이미 발송됨

      let formId = getText(props, "양식 ID (form_id)")
      if (!formId) {
        const contractType = getSelect(props, "계약종류")
        if (contractType) formId = CONTRACT_TYPE_FORM_ID_MAP[contractType]
      }
      const receiverEmail = getEmail(props, "수신자 이메일")
      const title = getTitle(props, "계약명")

      if (!formId || !receiverEmail || !title) {
        const contractType = getSelect(props, "계약종류")
        const formIdHint =
          contractType && !CONTRACT_TYPE_FORM_ID_MAP[contractType]
            ? ` ("계약종류"에 "${contractType}"를 선택했지만 매핑된 템플릿이 없습니다 — 지원 종류: ${Object.keys(CONTRACT_TYPE_FORM_ID_MAP).join(", ")})`
            : ""
        const reason = `양식 ID(form_id) 또는 계약 종류 / 수신자 이메일 / 계약명 중 비어 있는 값이 있습니다.${formIdHint}`
        await notion.pages.update({
          page_id: pageId,
          properties: { "API 메모": richText(`자동 발송 실패: ${reason}`) },
        })
        await notifyEvent({
          emoji: "⚠️",
          headline: "발송 실패",
          source: "계약 발송 자동화 (widsignSendOnStatusChange)",
          contractTitle: title,
          pageId,
          detail: reason,
        })
        continue
      }

      const receiverName = getText(props, "수신자 이름") ?? receiverEmail
      const receiverMobile = getPhone(props, "수신자 연락처")
      const sendType = (getSelect(props, "전송 방식") as "SAMETIME" | "SEQUENTIAL" | undefined) ?? "SAMETIME"

      const row: Partial<Record<DbFieldKey, string>> = { 계약명: title }
      const amount = getNumber(props, "계약금액")
      if (amount !== undefined) row["계약금액"] = numberToKoreanWon(amount)
      const contractPeriod = getDate(props, "계약기간")
      if (contractPeriod) row["계약기간"] = formatDateRange(contractPeriod.start, contractPeriod.end)
      const writtenDate = getDate(props, "작성일자")
      if (writtenDate) row["작성일자"] = formatDate(writtenDate.start)
      const exhibitName = getText(props, "전시명")
      if (exhibitName) row["전시명"] = exhibitName
      const exhibitPeriod = getDate(props, "전시기간")
      if (exhibitPeriod) row["전시기간"] = formatDateRange(exhibitPeriod.start, exhibitPeriod.end)
      const installDate = getDate(props, "설치일정")
      if (installDate) row["설치일정"] = formatDate(installDate.start)
      const exhibitPlace = getText(props, "전시장소")
      if (exhibitPlace) row["전시장소"] = exhibitPlace

      let items: { id: string; value: string }[]
      try {
        items = buildSendItems(formId, row)
      } catch (error) {
        await notion.pages.update({
          page_id: pageId,
          properties: { "API 메모": richText(`자동 발송 실패: ${(error as Error).message}`) },
        })
        await notifyEvent({
          emoji: "⚠️",
          headline: "발송 실패",
          source: "계약 발송 자동화 (widsignSendOnStatusChange)",
          contractTitle: title,
          pageId,
          detail: (error as Error).message,
        })
        continue
      }

      try {
        const result = (await widsign.sendForm({
          form_id: formId,
          title,
          send_type: sendType,
          receiver_list: [{ name: receiverName, email: receiverEmail, mobile: receiverMobile }],
          items,
        })) as {
          send_id: number
          svc_owner_id: number
          result: { receiver_meta_id: string; send_url: string; send_url_mobile: string }[]
        }
        const first = result.result[0]

        await notion.pages.update({
          page_id: pageId,
          properties: {
            "양식 ID (form_id)": richText(formId),
            "발송 ID (send_id)": { number: result.send_id },
            "수신자 ID": richText(first?.receiver_meta_id ?? ""),
            "서명 URL": { url: first?.send_url ?? null },
            "모바일 서명 URL": { url: first?.send_url_mobile ?? null },
            "서비스 계정 ID": { number: result.svc_owner_id },
            "API 상태 코드": { select: { name: "SEND" } },
            "발송일시": { date: { start: new Date().toISOString() } },
            "API 메모": richText("자동 발송 완료"),
          },
        })
        await notifyEvent({
          emoji: "✅",
          headline: "계약 발송",
          source: "계약 발송 자동화 (widsignSendOnStatusChange)",
          contractTitle: title,
          pageId,
          detail: `수신자: ${receiverEmail}`,
        })
      } catch (error) {
        await notion.pages.update({
          page_id: pageId,
          properties: { "API 메모": richText(`자동 발송 실패: ${(error as Error).message}`) },
        })
        await notifyEvent({
          emoji: "⚠️",
          headline: "발송 실패",
          source: "계약 발송 자동화 (widsignSendOnStatusChange)",
          contractTitle: title,
          pageId,
          detail: (error as Error).message,
        })
      }
    }
  },
})

// ---- 웹훅: 완료된 계약 감지 → 계약서 첨부 + 수신자 입력값 회수 ----
// 위드싸인에는 "서명 완료" 웹훅이 없어 이벤트 기반으로 감지할 수 없다. 대신 Notion
// 자동화의 "정기적으로(Every ...)" 트리거 + 필터 뷰(발송 ID가 있고 완료 계약서가 비어있는
// 행만) 조합으로 주기 폴링을 흉내낸다. Notion에서 해당 필터 뷰를 만들고, 자동화
// 트리거를 그 뷰로 지정한 뒤 액션으로 이 웹훅을 호출하도록 설정해야 한다
// (body: {"page_id": "{{Page ID}}"}).
worker.webhook("widsignSyncCompletedDocument", {
  title: "위드싸인 완료 계약 동기화",
  description:
    "발송된 계약이 위드싸인에서 완료(END)됐는지 확인하고, 완료됐으면 계약서 사본을 " +
    "Notion에 첨부하고 수신자가 입력한 값(계약상대자명/주소/대표자명/입금계좌)을 회수해 반영합니다. " +
    "아직 완료되지 않았으면 아무 것도 하지 않습니다(다음 주기에 재시도). " +
    "Notion 자동화의 웹훅 body는 {\"page_id\": \"{{Page ID}}\"} 형태여야 합니다.",
  execute: async (events, { notion }) => {
    for (const event of events) {
      const pageId = event.body.page_id
      if (typeof pageId !== "string" || !pageId) continue

      const page = await notion.pages.retrieve({ page_id: pageId })
      if (!("properties" in page)) continue
      const props = page.properties as Record<string, unknown>

      if (hasFiles(props, "완료 계약서")) continue // 이미 처리됨

      const formId = getText(props, "양식 ID (form_id)")
      const receiverMetaId = getText(props, "수신자 ID")
      const sendId = getNumber(props, "발송 ID (send_id)")
      const title = getTitle(props, "계약명")
      if (!formId || !receiverMetaId || sendId === undefined) continue

      // 위드싸인에서 실제 최신 상태를 재확인한다 (Notion 쪽 값은 오래됐을 수 있음).
      const docs = (await widsign.listDocs({ send_id: sendId })) as { result: { status: string }[] }
      const status = docs.result[0]?.status
      if (status !== "END") continue // 아직 서명 완료 전 — 다음 주기에 재시도

      try {
        await syncCompletedContract(notion, pageId, formId, receiverMetaId)
        await notifyEvent({
          emoji: "🎉",
          headline: "계약 완료",
          source: "완료 동기화 웹훅 (widsignSyncCompletedDocument)",
          contractTitle: title,
          pageId,
        })
      } catch (error) {
        await notion.pages.update({
          page_id: pageId,
          properties: { "API 메모": richText(`자동 동기화 실패: ${(error as Error).message}`) },
        })
        await notifyEvent({
          emoji: "⚠️",
          headline: "완료 처리 실패",
          source: "완료 동기화 웹훅 (widsignSyncCompletedDocument)",
          contractTitle: title,
          pageId,
          detail: (error as Error).message,
        })
      }
    }
  },
})
