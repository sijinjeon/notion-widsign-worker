# 자동화 연결

`ntn workers deploy` 이후 두 개의 웹훅 capability가 등록됩니다. Notion 데이터베이스 자동화에서 이 웹훅들을 액션으로 연결하면 트리거가 완성됩니다.

```bash
ntn workers webhooks list
```

## 1. 자동 발송 — `widsignSendOnStatusChange`

- **트리거**: 속성 변경 — `진행상태`가 `발송`으로 바뀔 때
- **대상**: 전체 데이터베이스
- **액션**: 웹훅 보내기
- **Body**: `{"page_id": "{{Page ID}}"}`

이미 `발송 ID`가 있는 행은 중복 발송을 방지하기 위해 건너뜁니다.

## 2. 완료 계약 자동 동기화 — `widsignSyncCompletedDocument`

위드싸인에는 "서명 완료" 웹훅이 없어서, Notion의 "정기적으로" 트리거로 폴링을 흉내냅니다.

1. **필터 뷰 생성**: `발송 ID`가 비어있지 않음 AND `완료 계약서`가 비어있음
2. **자동화 생성**
   - **트리거**: 정기적으로 (예: 1시간마다)
   - **대상**: 위에서 만든 필터 뷰
   - **액션**: 웹훅 보내기
   - **Body**: `{"page_id": "{{Page ID}}"}`

이 웹훅은 매번 위드싸인의 실제 상태를 재확인하고, 아직 서명 완료 전이면 아무 것도 하지 않습니다 (다음 주기에 재시도).

## `automation` capability를 쓸 수 있는 경우

워크스페이스에 Notion Workers의 `automation` capability가 활성화돼 있다면, 위 두 웹훅 대신 `worker.automation(...)`으로 더 간단하게 구성할 수 있습니다 (Notion 데이터베이스 자동화 설정 없이, Worker 코드만으로 트리거 처리). `.examples/automation-example.ts` 참고.
