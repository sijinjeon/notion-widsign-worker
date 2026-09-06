# Notion 데이터베이스 스키마

이 Worker가 기대하는 Notion 데이터베이스 속성 목록입니다.

**자동 생성**: `npm run setup:db -- <상위 페이지 ID>`를 실행하면 `scripts/setup-database.ts`가 Notion API로 이 스키마 그대로 데이터베이스를 만듭니다 (상위 페이지에 `NOTION_API_TOKEN`의 연결을 먼저 공유해야 함). `진행상태`의 그룹 배정만 API가 지원하지 않아 실행 후 수동으로 옮겨야 합니다.

수동으로 만들고 싶다면, 아래 표를 Notion AI나 Claude에게 보여주고 "이 속성 그대로 데이터베이스를 만들어줘"라고 해도 됩니다.

| 속성명 | 타입 | 옵션 / 비고 |
|---|---|---|
| 계약명 | title | 위드싸인 전송 문서 제목 |
| 진행상태 | status | 계약 준비, 내부 검토 (시작 전) / 작성 중, 발송 (진행 중) / 완료, 취소, 거절, 만료 (완료) |
| 계약상대자 | rich_text | 수신자가 서명 중 직접 입력 |
| 계약상대자 대표자명 | rich_text | 수신자 입력 |
| 계약상대자 주소 | rich_text | 수신자 입력 |
| 계약기간 | date | 발신자 입력 |
| 계약금액 | number (원화) | 발신자 입력, 발송 시 한글 금액으로 자동 변환 |
| 작성일자 | date | 발신자 입력 |
| 전시명 / 전시기간 / 전시장소 / 설치일정 | rich_text / date / rich_text / date | 발신자 입력 (프로젝트 성격에 맞게 이름 바꿔도 됨) |
| 입금은행 / 계좌번호 / 예금주 | rich_text | 수신자 입력 |
| 수신자 이메일 / 수신자 연락처 / 수신자 이름 | email / phone_number / rich_text | 발송 전 필수 |
| 발신자 이메일 | email | 발송 계정 기록용 |
| 양식 ID (form_id) | rich_text | 위드싸인 템플릿 ID. 직접 입력하는 대신 "계약종류"를 고르면 자동 채워짐(발송 성공 시 기록) |
| 계약종류 | select | 전시참여작가 — `src/widsign/fieldMapping.ts`의 `CONTRACT_TYPE_FORM_ID_MAP`과 옵션명이 정확히 일치해야 함. 재사용 가능한 템플릿만 등록(계약 1건짜리 과거 문서는 제외) |
| 전송 방식 | select | SAMETIME, SEQUENTIAL |
| 발송 ID (send_id) | number | 자동 기록 |
| 수신자 ID | rich_text | receiver_meta_id, 자동 기록 |
| 서비스 계정 ID | number | svc_owner_id, 자동 기록 |
| 서명 URL / 모바일 서명 URL | url | 자동 기록 |
| 발송일시 / 완료일시 / 서명 만료일 / 최근 동기화 | date | 자동 기록 |
| API 상태 코드 | select | SEND, WRITING, CONVERT, END, CANCEL, REJECT, EXPIRATION, STANDBY, APPROVAL-END, APPROVAL-REJECT |
| API 메모 | rich_text | 자동화 실행 로그 |
| 완료 계약서 / 감사추적인증서 | files | 완료 후 자동 첨부 |
| 필수 증빙서류 | files | 수동 첨부 |
| 담당자 | person | |
| 등록일 / 최종 수정일 | created_time / last_edited_time | Notion 자동 |

프로젝트 성격에 따라 전시 관련 속성(전시명·전시기간 등)은 자유롭게 다른 이름으로 바꿔도 됩니다 — `src/index.ts`와 `src/widsign/fieldMapping.ts`의 `DbFieldKey`도 함께 맞춰주면 됩니다.
