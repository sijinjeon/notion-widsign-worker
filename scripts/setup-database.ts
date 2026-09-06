/**
 * "전자계약 관리 DB"를 Notion API로 지정한 상위 페이지 아래에 생성한다.
 * docs/DATABASE_SCHEMA.md의 스키마를 그대로 코드로 옮긴 것 — 표를 고치면 이 파일도 맞춰 고친다.
 *
 * 사용법:
 *   npm run setup:db -- <상위 페이지 ID 또는 URL>
 *
 * 상위 페이지에 NOTION_API_TOKEN의 연결(Integration)이 미리 공유되어 있어야 한다.
 */
import { Client } from "@notionhq/client"

try {
  process.loadEnvFile(".env")
} catch {
  // .env가 없으면 이미 export된 환경변수를 그대로 쓴다
}

const token = process.env.NOTION_API_TOKEN
if (!token) {
  console.error("NOTION_API_TOKEN이 설정되어 있지 않습니다. .env를 확인하세요.")
  process.exit(1)
}

const parentArg = process.argv[2]
if (!parentArg) {
  console.error("사용법: npm run setup:db -- <상위 페이지 ID 또는 URL>")
  process.exit(1)
}

// URL로 붙여넣었을 경우 32자리 ID만 뽑아낸다.
const parentId = (parentArg.match(/[0-9a-f]{32}/i) ?? [parentArg])[0]

const notion = new Client({ auth: token })

async function main() {
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentId },
    title: [{ type: "text", text: { content: "전자계약 관리 DB" } }],
    icon: { type: "emoji", emoji: "✍️" },
    initial_data_source: {
      properties: {
        "계약명": { type: "title", title: {} },
        "진행상태": {
          type: "status",
          status: {
            options: [
              { name: "계약 준비", color: "gray" },
              { name: "내부 검토", color: "yellow" },
              { name: "작성 중", color: "purple" },
              { name: "발송", color: "blue" },
              { name: "완료", color: "green" },
              { name: "취소", color: "red" },
              { name: "거절", color: "red" },
              { name: "만료", color: "orange" },
            ],
          },
        },
        "계약상대자": {
          type: "rich_text",
          rich_text: {},
          description: "전시 참여 작가 또는 업체명. 위드싸인 발송 시 receiver_list[].name(수신자 이름)으로 그대로 사용됨",
        },
        "계약상대자 대표자명": { type: "rich_text", rich_text: {} },
        "계약상대자 주소": { type: "rich_text", rich_text: {}, description: "계약서 기재 주소" },
        "계약기간": { type: "date", date: {}, description: "계약 효력 기간" },
        "계약금액": { type: "number", number: { format: "number" }, description: "창작 대가 총액" },
        "작성일자": { type: "date", date: {}, description: "계약서 작성 및 서명 기준일" },
        "전시명": { type: "rich_text", rich_text: {}, description: "계약 대상 전시 제목" },
        "전시기간": { type: "date", date: {}, description: "전시 시작일과 종료일" },
        "전시장소": { type: "rich_text", rich_text: {}, description: "작품 전시 장소" },
        "설치일정": { type: "date", date: {}, description: "작품 설치 예정일" },
        "입금은행": { type: "rich_text", rich_text: {}, description: "계약상대자 지급 계좌 은행" },
        "계좌번호": { type: "rich_text", rich_text: {}, description: "계약상대자 지급 계좌번호" },
        "예금주": { type: "rich_text", rich_text: {}, description: "계약상대자 지급 계좌 예금주" },
        "수신자 이메일": { type: "email", email: {}, description: "receiver_email" },
        "수신자 연락처": { type: "phone_number", phone_number: {}, description: "receiver_mobile" },
        "수신자 이름": { type: "rich_text", rich_text: {} },
        "발신자 이메일": { type: "email", email: {}, description: "sender_email" },
        "양식 ID (form_id)": { type: "rich_text", rich_text: {}, description: "위드싸인 템플릿/양식 식별자" },
        "계약종류": {
          type: "select",
          select: {},
          description:
            "옵션명은 src/widsign/fieldMapping.ts의 CONTRACT_TYPE_FORM_ID_MAP 키와 정확히 일치해야 함. " +
            "옵션을 고르면 양식 ID (form_id)가 자동으로 채워짐 — docs/TEMPLATE_ID_GUIDE.md 참고",
        },
        "전송 방식": {
          type: "select",
          select: {
            options: [
              { name: "SAMETIME", color: "blue" },
              { name: "SEQUENTIAL", color: "purple" },
            ],
          },
        },
        "발송 ID (send_id)": { type: "number", number: { format: "number" }, description: "계약 발송 후 반환되는 식별자" },
        "수신자 ID": { type: "rich_text", rich_text: {}, description: "receiver_meta_id" },
        "서비스 계정 ID": { type: "number", number: { format: "number" }, description: "svc_owner_id" },
        "서명 URL": { type: "url", url: {}, description: "위드싸인 send_url" },
        "모바일 서명 URL": { type: "url", url: {}, description: "위드싸인 send_url_mobile" },
        "발송일시": { type: "date", date: {}, description: "위드싸인 계약 발송 시각" },
        "완료일시": { type: "date", date: {}, description: "모든 서명이 완료된 시각" },
        "서명 만료일": { type: "date", date: {}, description: "위드싸인 expiration_date" },
        "최근 동기화": { type: "date", date: {}, description: "위드싸인 API 상태를 마지막으로 확인한 시각" },
        "API 상태 코드": {
          type: "select",
          select: {
            options: [
              { name: "SEND", color: "blue" },
              { name: "WRITING", color: "purple" },
              { name: "CONVERT", color: "yellow" },
              { name: "END", color: "green" },
              { name: "CANCEL", color: "red" },
              { name: "REJECT", color: "red" },
              { name: "EXPIRATION", color: "orange" },
              { name: "STANDBY", color: "gray" },
              { name: "APPROVAL-END", color: "green" },
              { name: "APPROVAL-REJECT", color: "red" },
            ],
          },
          description: "위드싸인 API status/doc_status 원문 값",
        },
        "API 메모": { type: "rich_text", rich_text: {}, description: "API 오류, 취소·거절 사유 및 동기화 메모" },
        "완료 계약서": { type: "files", files: {}, description: "서명 완료 계약서 PDF 사본" },
        "감사추적인증서": { type: "files", files: {}, description: "위드싸인 감사추적인증서 PDF" },
        "필수 증빙서류": { type: "files", files: {}, description: "신분증 또는 사업자등록증, 통장사본" },
        "1차 지급예정일": { type: "date", date: {}, description: "계약서 작성일로부터 10일 이내, 계약금액의 50%" },
        "1차 지급완료": { type: "checkbox", checkbox: {}, description: "계약금액 50% 지급 여부" },
        "2차 지급예정일": { type: "date", date: {}, description: "전시 개막일로부터 10일 이내, 계약금액의 50%" },
        "2차 지급완료": { type: "checkbox", checkbox: {}, description: "계약금액 50% 지급 여부" },
        "개인정보 수집·이용 동의": { type: "checkbox", checkbox: {}, description: "성명, 주소, 연락처, 이메일, 신분증/사업자등록증, 통장사본 수집·이용 동의" },
        "고유식별정보 처리 동의": { type: "checkbox", checkbox: {}, description: "개인정보보호법 제24조 관련 동의" },
        "제3자 제공 동의": { type: "checkbox", checkbox: {}, description: "국세청 세무신고 목적의 제3자 정보 제공 동의" },
        "담당자": { type: "people", people: {}, description: "계약 업무 담당자" },
        "등록일": { type: "created_time", created_time: {} },
        "최종 수정일": { type: "last_edited_time", last_edited_time: {} },
      },
    },
  })

  console.log("생성 완료:", "url" in db ? db.url : db.id)
  console.log("")
  console.log(
    "⚠️  '진행상태' 옵션 8개는 이름·색상까지 정확히 만들어졌지만, Notion API가 그룹(시작 전/진행 중/완료)까지는 " +
      "지정하지 못해 전부 '시작 전' 그룹에 들어가 있습니다. Notion에서 진행상태 속성을 열어 각 옵션을 알맞은 " +
      "그룹으로 드래그해주세요 — 진행 중: 작성 중·발송 / 완료: 완료·취소·거절·만료.",
  )
}

main().catch((error) => {
  console.error("생성 실패:", error instanceof Error ? error.message : error)
  process.exit(1)
})
