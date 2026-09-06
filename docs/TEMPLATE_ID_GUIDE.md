# 위드싸인 템플릿 ID 찾아서 등록하기

새로운 계약 종류를 이 시스템에 추가하려면, 그 계약서 템플릿의 **양식 ID(form_id)**를 알아내서 코드 몇 줄에 등록해야 합니다. 이 문서는 그 방법만 다룹니다.

## 1. 위드싸인에 템플릿 먼저 만들기

1. 위드싸인 대시보드에 로그인합니다.
2. 왼쪽 메뉴에서 **템플릿 관리 → 템플릿 만들기**를 클릭합니다. (**"새템플릿 전송하기"는 누르지 마세요** — 그건 템플릿을 저장하지 않고 바로 실제 발송까지 진행하는 버튼입니다. 우리는 나중에 반복해서 쓸 수 있도록 템플릿을 "저장"해야 합니다.)
3. 계약서 원본 파일을 업로드합니다. 지원 형식은 PDF, JPG, JPEG, PNG, DOC, HWP이고, 10MB 이하여야 합니다.
4. 계약마다 값이 달라지는 부분(성명·주소·계좌번호·금액 등)이 있으면 화면에서 입력 필드를 배치합니다. 필드가 전혀 없어도(내용이 고정된 계약서) 괜찮습니다. 필드를 발신자용/수신자용으로 구분하는 요령은 `docs/FIELD_PLACEMENT.md` 참고.
5. 완료되면 저장합니다. (위드싸인 화면 자체에는 이 템플릿의 "ID"를 보여주는 곳이 없습니다 — ID는 다음 단계에서 API로 조회합니다.)

## 2. 템플릿 ID(form_id) 찾기

이미 `.env`/`ntn workers env`에 `WIDSIGN_API_ID`/`WIDSIGN_API_KEY`를 설정하고 `ntn workers deploy`까지 마쳤다면, 두 가지 방법 중 편한 쪽으로 조회할 수 있습니다.

**방법 A — 터미널에서 직접 (AI 없이 가능)**
```bash
ntn workers exec widsignListTemplates
```
템플릿 이름과 함께 `form_id`(예: `6a968f8c018f754b016eb79d` 같은 24자리 문자열)가 나옵니다. 원하는 템플릿을 찾아 이 값을 복사하세요.

특정 템플릿의 필드 목록까지 보고 싶으면:
```bash
ntn workers exec widsignTemplateDetail -d '{"form_id": "방금_찾은_form_id"}'
```

**방법 B — Notion AI나 Claude에게 요청하기**

> "widsignListTemplates 도구로 위드싸인 템플릿 목록을 보여줘"

똑같은 결과를 대화로 받을 수 있습니다. 이 방법은 3번 단계(코드 작성)까지 이어서 도움받기 편합니다.

## 3. ID를 코드에 등록하기

`src/widsign/fieldMapping.ts`를 열어 `CONTRACT_TYPE_FORM_ID_MAP`에 한 줄 추가합니다:

```ts
export const CONTRACT_TYPE_FORM_ID_MAP: Record<string, string> = {
  전시참여작가: "6a968f8c018f754b016eb79d",
  청소계약: "여기에_방금_찾은_form_id_입력", // 새로 추가
}
```

키(왼쪽, 예: `청소계약`)는 **Notion "계약종류" select 속성의 옵션명과 정확히 똑같아야** 합니다 — 띄어쓰기 하나도 다르면 안 됩니다.

그 다음 Notion에서 "계약종류" 속성을 열어 같은 이름으로 옵션을 하나 추가합니다.

## 4. (필요한 경우) 템플릿 필드 매핑

여기서부터는 템플릿에 **사람이 계약마다 다르게 채워야 하는 입력 필드**(계약금액, 계약상대자명, 계좌번호 등)가 있는지에 따라 갈립니다.

- **필드가 아예 없는 템플릿** (내용이 이미 문서 이미지에 고정 인쇄돼 있음): 아무 것도 안 해도 됩니다. `src/widsign/fieldMapping.ts`의 `NO_FILLABLE_FIELDS_FORM_IDS` 배열에 이 form_id를 한 줄 추가만 해주세요.
- **필드가 있는 템플릿**: 각 필드가 무엇을 의미하는지(계약상대자명인지, 계좌번호인지 등) 확인해서 `FORM_ITEM_MAP`에 매핑을 추가해야 합니다. 이건 코드 작업이 필요한 단계라, **Claude나 ChatGPT 같은 AI에게 아래를 그대로 보여주고 도와달라고 하는 걸 추천합니다:**

  1. 2번에서 얻은 `widsignTemplateDetail` 결과 (필드 목록 JSON)
  2. "이 필드들 중 어떤 게 계약상대자명/주소/계좌번호 등에 해당하는지, 템플릿 배경 이미지를 보고 확인해서 `src/widsign/fieldMapping.ts`의 `FORM_ITEM_MAP`에 추가해줘"라는 요청

  AI가 배경 이미지를 열어 위치를 대조하고 코드까지 작성해줄 수 있습니다. 사람이 직접 할 경우 `docs/FIELD_PLACEMENT.md`와 기존 `FORM_ITEM_MAP` 항목들을 참고해서 똑같은 형식으로 작성하면 됩니다.

## 5. 확인 및 배포

```bash
npm run check        # 오타·타입 오류 확인
ntn workers deploy    # 반영
```

배포 후 Notion에서 "계약종류"를 새 옵션으로 선택하고 발송 테스트를 해보세요. 실패하면 해당 행의 "API 메모"에 이유가 남습니다.
