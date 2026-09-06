# notion-widsign-worker

Notion 데이터베이스에서 위드싸인(WidSign) 전자계약을 자동으로 발송하고, 서명 완료 후 계약서 사본과 수신자 입력값을 다시 Notion으로 회수하는 [Notion Worker](https://developers.notion.com/docs/workers).

## 무엇을 자동화하나

1. Notion DB에서 `진행상태`를 `발송`으로 바꾸면 → 위드싸인으로 계약서 자동 발송
2. 수신자가 이메일을 받아 직접 서명 (계약상대자명·주소·계좌정보 등은 수신자가 서명 중 입력)
3. 서명이 완료되면 → 완료 계약서 PDF + 감사추적인증서를 Notion 파일 속성에 자동 첨부, 수신자가 입력한 값을 Notion 속성으로 자동 회수

Notion Workers에는 아직 "정기 실행" 자동화(automation) 기능이 워크스페이스별로 활성화돼 있지 않을 수 있어, 이 프로젝트는 그 경우 **Notion 자체의 데이터베이스 자동화(웹훅 액션)** 로 우회하는 방식을 씁니다. Worker의 `automation` capability가 활성화된 워크스페이스라면 더 간단하게 구성할 수 있습니다.

## 구조

```
src/
  index.ts              # tool·webhook 진입점 (여기서 아래 모듈들을 조립)
  widsign/
    client.ts           # 위드싸인 API v2 저수준 클라이언트 (인증, GET/POST/바이너리)
    api.ts               # 위드싸인 API 엔드포인트별 함수 (발송, 조회, 다운로드 등)
    fieldMapping.ts       # 템플릿별 "필드 ID ↔ Notion 속성" 매핑 + items 배열 생성
  notion/
    properties.ts         # Notion 페이지 속성 파싱 헬퍼 (title/rich_text/date/...)
    format.ts             # 숫자→한글 금액 표기, 날짜 포맷 등
scripts/
  setup-database.ts       # NOTION_API_TOKEN으로 "전자계약 관리 DB"를 자동 생성 (npm run setup:db)
```

## 이 저장소를 fork해서 자기 것으로 쓰려면

이 코드는 특정 계정(위드싸인 계정, Notion 워크스페이스)에 종속되지 않은 로직입니다. `fieldMapping.ts`의 form_id·item_id 예시 값은 **원 제작자의 위드싸인 계정 값**이라 그대로는 동작하지 않습니다 — 자신의 위드싸인 템플릿으로 교체해야 합니다.

1. **Notion CLI 설치 및 로그인**
   ```bash
   curl -fsSL https://ntn.dev | bash
   ntn login
   ```
2. **이 저장소를 fork/clone한 뒤 Worker로 배포**
   ```bash
   ntn workers deploy --name <원하는-이름>
   ```
3. **환경변수(시크릿) 설정**
   - 위드싸인 API 키: 위드싸인 관리자 페이지에서 발급 (Business/Enterprise 플랜 필요)
   - Notion API 토큰: [Notion 연결(Integration)](https://app.notion.com/developers/connections) 생성 후, 사용할 데이터베이스에 연결 공유

   두 가지 방법 중 편한 쪽으로 설정합니다.

   **방법 A — 키를 하나씩 직접 지정** (`.env` 파일을 로컬에 남기지 않음)
   ```bash
   ntn workers env set WIDSIGN_API_ID=xxx WIDSIGN_API_KEY=xxx NOTION_API_TOKEN=xxx
   ```

   **방법 B — `.env` 파일로 한 번에 push** (`.env.example` 복사해서 채운 뒤)
   ```bash
   cp .env.example .env   # 값을 채운 뒤
   ntn workers env push
   ```

   설정된 키 목록 확인(값은 노출되지 않음), 삭제, 다른 환경으로 값 내려받기는 각각:
   ```bash
   ntn workers env list
   ntn workers env unset <KEY>
   ntn workers env pull        # 원격 값을 로컬 .env로 (팀원과 협업할 때 유용)
   ```
   자세한 내용은 `docs/SECRETS.md` 참고.
4. **Notion 데이터베이스 준비**
   NOTION_API_TOKEN의 연결(Integration)을 상위 페이지에 먼저 공유한 뒤, 스크립트로 자동 생성합니다.
   ```bash
   npm run setup:db -- <상위 페이지 ID 또는 URL>
   ```
   Notion API는 `진행상태` 옵션의 이름·색상은 정확히 만들지만 그룹(시작 전/진행 중/완료) 배정은 못 해서, 실행 후 안내되는 대로 옵션 몇 개만 원하는 그룹으로 드래그해주면 됩니다. 스크립트를 안 쓰고 싶다면 `docs/DATABASE_SCHEMA.md`의 속성 표를 보고 직접 만들어도 됩니다.
5. **위드싸인 템플릿 준비 및 등록**
   계약서 원본(Word/한글)을 위드싸인 대시보드에 업로드하고 필드를 배치합니다. 발신자가 미리 채울 필드와 수신자가 서명 중 입력할 필드를 구분해서 배치하세요 (`docs/FIELD_PLACEMENT.md` 참고). 템플릿의 양식 ID(form_id)를 찾아 `CONTRACT_TYPE_FORM_ID_MAP`과 Notion "계약종류" 속성에 등록하는 방법은 **`docs/TEMPLATE_ID_GUIDE.md`**를 따라하세요 — 코드 수정이 필요한 부분은 AI에게 도와달라고 요청하는 방법도 안내돼 있습니다.
6. **자동화 연결**
   ```bash
   ntn workers webhooks list
   ```
   로 웹훅 URL을 확인하고, Notion 데이터베이스의 자동화 설정에서 연결합니다 (`docs/AUTOMATION_SETUP.md` 참고).

## "계약종류" 자동 매핑

Notion DB에 "양식 ID (form_id)"를 직접 입력하는 대신, "계약종류" select 속성에서 종류만 고르면 `src/widsign/fieldMapping.ts`의 `CONTRACT_TYPE_FORM_ID_MAP`을 찾아 자동으로 해당 위드싸인 템플릿으로 발송합니다. 매핑 안 된 종류를 고르면 발송 대신 "API 메모"에 오류가 남습니다(잘못된 템플릿으로 나가는 사고 방지). 새 종류를 추가하는 방법은 `docs/TEMPLATE_ID_GUIDE.md` 참고.

## 완료 계약 자동 확인 (선택 기능)

`src/sync/scheduledCompletionSync.ts`는 Notion 자동화 없이 **Worker 스스로 주기적으로 깨어나** 완료된 계약을 찾아 반영하는 기능입니다. 배포하면 자동으로 활성화되며, Worker 내부용 "위드싸인 동기화 스케줄러"라는 작은 DB가 워크스페이스에 하나 생깁니다(실제 계약 데이터는 안 들어있음 — 지워도 되지만 안 지워도 됨).

- 기본적으로 매시간 깨어나지만, 실제 조회·처리는 지정한 요일·시각(기본: 화~토 8시·15시, KST)에만 하고 나머지는 API 호출 없이 바로 끝납니다 — 실행 비용을 아끼기 위해서입니다.
- `WIDSIGN_SYNC_DATA_SOURCE_ID`를 설정하지 않으면 이 기능은 아무 일도 하지 않습니다(완전히 꺼진 것과 동일) — 즉 원치 않으면 이 env var를 비워두면 됩니다.
- `WIDSIGN_DRY_RUN`(기본 `true`)이 켜져 있으면 실제로는 아무 것도 수정하지 않고 로그만 남깁니다. 동작을 충분히 확인한 뒤에만 `false`로 바꾸세요.
- 관련 env var 전체 목록과 설명은 `.env.example` 참고.

이미 있는 웹훅(`widsignSyncCompletedDocument` + Notion DB 자동화)만으로도 완료 확인은 되지만, 그쪽은 Notion 자동화의 최소 주기(하루)만큼 반영이 늦을 수 있습니다. 더 빠른 반영이 필요 없다면 이 기능은 없어도 무방합니다(다만 위에서 설명한 대로 배포하면 기본적으로 켜져 있습니다).

## 참고 문서

- `docs/TEMPLATE_ID_GUIDE.md` — 새 계약 종류(위드싸인 템플릿) 추가하는 법
- `docs/NOTION_WORKERS_SDK.md` — Notion Workers SDK 사용법 (scaffold 시 기본 제공되는 문서)
- `.examples/` — Notion Workers의 tool/webhook/sync/automation 예제 코드

## 라이선스

MIT — 자유롭게 fork·수정·재배포해서 사용하세요.
