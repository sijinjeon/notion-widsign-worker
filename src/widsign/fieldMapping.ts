/**
 * 위드싸인 템플릿별 "항목 사전입력값(items)" 매핑.
 *
 * 배경: `form/send`의 `items` 배열은 {id, value} 형태이고, id는 템플릿(form_id)마다
 * 다르다. 또한 템플릿 필드 이름이 항상 의미를 담고 있지 않다 ("텍스트1" 등) —
 * 그래서 이 매핑은 각 템플릿의 배경 이미지를 실제로 열어 눈으로 위치를 확인한 뒤에만
 * 채워 넣었다. 확인하지 않은 값을 추측해서 넣지 않는다 (계좌번호 등이 엉뚱한 칸에
 * 들어가면 실제 계약서가 잘못 나갈 수 있다).
 *
 * 같은 정보(예: 계약상대자명)가 표지 페이지와 서명 페이지 등 여러 곳에 반복
 * 인쇄되는 경우가 있어, 하나의 DB 값이 여러 item id에 매핑될 수 있다.
 *
 * 소다미술관 "전자계약 관리 DB"의 속성명을 키로 사용한다.
 */

export type DbFieldKey =
  | "계약명"
  | "계약기간"
  | "계약금액"
  | "작성일자"
  | "계약상대자"
  | "계약상대자 주소"
  | "계약상대자 대표자명"
  | "계좌번호"
  | "예금주"
  | "입금은행"
  | "전시명"
  | "전시기간"
  | "설치일정"
  | "전시장소"

export interface FormFieldMapping {
  /** 템플릿(양식) 제목 — 매핑 대상 확인용 참고 정보. */
  title: string
  /** DB 컬럼 키 -> 템플릿 필드 item id 목록 (같은 값을 여러 필드에 반복 기재하는 경우 대비).
   *  이 필드들은 발신자(우리)가 발송 시점에 값을 채워 넣는다 (group_num 0). */
  fields: Partial<Record<DbFieldKey, string[]>>
  /** DB 컬럼 키 -> 템플릿 필드 item id 목록. 이 필드들은 수신자가 서명 과정에서
   *  직접 입력한다 (group_num 1) — 발송 시 값을 채우지 않고, 계약 완료 후
   *  extractReceiverValues()로 값을 읽어와 DB에 반영한다. */
  receiverFields?: Partial<Record<DbFieldKey, string[]>>
  /** 매핑했지만 DB에 대응 컬럼이 없거나 확신이 낮아 값을 채우지 않은 필드 (참고 기록). */
  unmapped?: { itemId: string; itemName: string; note: string }[]
}

/**
 * 검증 완료: GET /form/detail 로 필드 좌표를 확인하고, 배경 이미지를 직접 열어
 * 각 필드가 어떤 내용인지 시각적으로 대조했다.
 */
export const FORM_ITEM_MAP: Record<string, FormFieldMapping> = {
  // 비이닷병점 입주청소 계약서 최종본_20260716
  "6a585eb0365aa6b2d355f7dd": {
    title: "비이닷병점 입주청소 계약서 최종본_20260716",
    fields: {
      입금은행: ["6a585f09ce2c5d6817000003"], // 텍스트1
      계좌번호: ["6a585f49ce2c5d6817000006"], // 텍스트2
      예금주: ["6a585f4ece2c5d6817000007"], // 텍스트3
      계약상대자: [
        "6a585f53ce2c5d6817000008", // 텍스트4 — 수급인 상호/성명 (계약서 서명란)
        "6a585f73ce2c5d681700000c", // 텍스트7 — 개인정보 동의서 성명란
      ],
      "계약상대자 주소": ["6a585f58ce2c5d6817000009"], // 텍스트5 — 수급인 소재지
    },
    unmapped: [
      {
        itemId: "6a585f60ce2c5d681700000a", // 텍스트6
        itemName: "텍스트6",
        note: "수급인 사업자번호. DB에 대응 컬럼 없음 — 필요 시 '계약상대자 사업자번호' 속성 추가 검토",
      },
    ],
  },

  // 계약서양식 01_전시 참여 작가_v2 — v3로 대체됨. 이미 발송된 v2 계약의 상세/수신자
  // 입력값 조회를 위해 매핑을 남겨두되, 신규 발송에는 v3(6a968f8c018f754b016eb79d)를 쓴다.
  "6a9682b1018f754b016e9330": {
    title: "계약서양식 01_전시 참여 작가_v2",
    fields: {
      계약명: ["6a9682bbce1ffe4d9a000011"],
      계약기간: ["6a9682ccce1ffe4d9a000012"],
      계약금액: [
        "6a9682e0ce1ffe4d9a000013", // 계약금액1 (표지)
        "6a96855fce1ffe4d9a00002a", // 계약금액2 (제3조 본문)
      ],
      작성일자: ["6a968398ce1ffe4d9a000014"],
      전시명: ["6a968517ce1ffe4d9a000023"],
      전시기간: ["6a968523ce1ffe4d9a000024"],
      설치일정: ["6a96853ace1ffe4d9a000026"],
      전시장소: ["6a968547ce1ffe4d9a000027"],
    },
    receiverFields: {
      계약상대자: [
        "6a9684d1ce1ffe4d9a00001e", // 계약상대자명1 (표지 서명란)
        "6a96850ace1ffe4d9a000022", // 계약상대자명2 (제1조 본문)
        "6a96859dce1ffe4d9a000030", // 계약상대자명3 (개인정보 동의서 성명란)
      ],
      "계약상대자 주소": ["6a9684e4ce1ffe4d9a00001f"],
      "계약상대자 대표자명": ["6a9684ecce1ffe4d9a000020"],
      입금은행: ["6a96856dce1ffe4d9a00002b"],
      계좌번호: ["6a96857fce1ffe4d9a00002e"],
      예금주: ["6a96858bce1ffe4d9a00002f"],
    },
  },

  // 계약서양식 01_전시 참여 작가_v3 — v2에서 계약상대자명/주소/대표자명/입금계좌 필드를
  // 실제로 수신자(group_num 1)로 재배치한 버전. 현재 사용 중인 최신 템플릿.
  "6a968f8c018f754b016eb79d": {
    title: "계약서양식 01_전시 참여 작가_v3",
    fields: {
      계약명: ["6a968f8d018f754b016eb7a7"],
      계약기간: ["6a968f8d018f754b016eb7a8"],
      계약금액: [
        "6a968f8d018f754b016eb7a9", // 계약금액1 (표지)
        "6a969021d1e03349eb00000a", // 계약금액1 (제3조 본문, 이름 중복이지만 다른 필드)
      ],
      작성일자: ["6a968f8d018f754b016eb7aa"],
      전시명: ["6a968f8d018f754b016eb7b1"],
      전시기간: ["6a968f8d018f754b016eb7b2"],
      설치일정: ["6a968f8d018f754b016eb7b3"],
      전시장소: ["6a968f8d018f754b016eb7b4"],
    },
    receiverFields: {
      계약상대자: [
        "6a968f8d018f754b016eb7ad", // 계약상대자명1 (표지 서명란)
        "6a968ffad1e03349eb000005", // 계약상대자명1 (제1조 본문, 이름 중복이지만 다른 필드)
        "6a968ffad1e03349eb000009", // 계약상대자명1 (개인정보 동의서 성명란, 이름 중복이지만 다른 필드)
      ],
      "계약상대자 주소": ["6a968f8d018f754b016eb7ae"],
      "계약상대자 대표자명": ["6a968f8d018f754b016eb7af"],
      입금은행: ["6a968f8d018f754b016eb7b6"],
      계좌번호: ["6a968f8d018f754b016eb7b7"],
      예금주: ["6a968f8d018f754b016eb7b8"],
    },
  },

  // 비이닷병점 패키지 디자인 협업 계약서
  "6a84000ed994df5b4d04aeeb": {
    title: "비이닷병점 패키지 디자인 협업 계약서",
    fields: {
      계약상대자: [
        "6a84003b27c5042b00000001", // 업체명 (표지 페이지 "계약상대자:" 란)
        "6a8400a927c5042b00000008", // 업체명 (서명 페이지 두 번째 [발주자] 란)
        "6a8400fb27c5042b00000010", // 성명 (개인정보 동의서 성명란)
      ],
      "계약상대자 주소": [
        "6a84004a27c5042b00000002", // 업체주소 (표지 페이지)
        "6a8400b127c5042b00000009", // 업체주소 (서명 페이지)
      ],
      입금은행: ["6a84008027c5042b00000005"], // 입금은행명
      계좌번호: ["6a84008d27c5042b00000006"], // 입금계좌번호
      예금주: ["6a84009427c5042b00000007"], // 계좌 예금주
    },
    unmapped: [
      {
        itemId: "6a84005f27c5042b00000003", // 대표자명 (표지 페이지, 계약상대자 측)
        itemName: "대표자명",
        note: "계약상대자(업체)의 대표자 개인 성명 — 업체명과 다른 값. DB에 대응 컬럼 없음",
      },
      {
        itemId: "6a8400ba27c5042b0000000a", // 대표자명 (서명 페이지, 계약상대자 측)
        itemName: "대표자명",
        note: "위 대표자명과 동일 항목의 반복(서명 페이지). DB에 대응 컬럼 없음",
      },
      {
        itemId: "6a84011727c5042b00000012", // 텍스트1
        itemName: "텍스트1",
        note:
          "표지 페이지 상단, 비이닷병점(발신자) 측 정보 블록 안에 위치 — 발신자 측 대표자명 칸으로 추정되나 " +
          "100% 확정하지 못함. 실제 발송 전 위드싸인 템플릿 편집 화면에서 직접 재확인 필요. " +
          "DB에서 오는 값이 아니라 고정값(회사 대표자명)일 가능성이 높음",
      },
    ],
  },

  // Be병점 개관전시 참여 계약서_이인영 — 계약상대자명/주소/대표자명/계좌정보 전부 수신자
  // 입력(group_num 1). 계약금액/전시정보는 이 템플릿에 필드가 없음(문서 이미지에 고정 인쇄).
  "6a4c4dede79ea6e95cc20fad": {
    title: "Be병점 개관전시 참여 계약서_이인영",
    fields: {},
    receiverFields: {
      계약상대자: [
        "6a4c4e8f879e696aec000006", // 텍스트3 (표지 "계약상대자:" 란)
        "6a4c4f19879e696aec00000b", // 텍스트2 (제1조 본문 반복)
      ],
      "계약상대자 주소": ["6a4c4ec8879e696aec000008"], // 주소1
      "계약상대자 대표자명": ["6a4c4e11879e696aec000004"], // 텍스트1 ("대표" 란)
      입금은행: ["6a4c4f7d879e696aec00000f"], // 텍스트5 (상단)
      계좌번호: ["6a4c4f49879e696aec00000d"], // 텍스트5 (중단)
      예금주: ["6a4c4f84879e696aec000010"], // 텍스트6 (하단)
    },
  },

  // Be병점 개관전시 참여 계약서_오가음 1-1 — 위 이인영 계약과 동일한 문서 구조.
  "6a4c6b0a021e919ed7462c39": {
    title: "Be병점 개관전시 참여 계약서_오가음 1-1",
    fields: {},
    receiverFields: {
      계약상대자: [
        "6a4c6b0b021e919ed7462c40", // 텍스트1 (표지 "계약상대자:" 란)
        "6a4c6b0b021e919ed7462c45", // 텍스트3 (제1조 본문 반복)
      ],
      "계약상대자 주소": ["6a4c6b0b021e919ed7462c41"], // 주소1
      "계약상대자 대표자명": ["6a4c6b0b021e919ed7462c42"], // 텍스트2 ("대표" 란)
      입금은행: ["6a4c6b0b021e919ed7462c46"], // 텍스트4
      계좌번호: ["6a4c6b0b021e919ed7462c47"], // 텍스트5
      예금주: ["6a4c6b0b021e919ed7462c48"], // 텍스트6
    },
  },

  // Be병점 개관전시 참여 계약서_임희주X박재형 (구버전) — 계약금액/전시정보는 문서
  // 이미지에 고정 인쇄돼 있어(제3조 1항) 이 템플릿엔 해당 필드가 없음. "입금은행" 필드는
  // 다른 두 템플릿과 달리 계좌번호/예금주와 다른 페이지(제3조 3항 아래)에 위치.
  "6a5432c5f072f29c106e5e5a": {
    title: "Be병점 개관전시 참여 계약서_임희주X박재형 (구버전)",
    fields: {},
    receiverFields: {
      계약상대자: [
        "6a543b94fd737b2f55000002", // 텍스트1 (표지 "계약상대자:" 란)
        "6a543bc8fd737b2f55000006", // 텍스트3 (제1조 본문 반복)
      ],
      "계약상대자 주소": ["6a543b9cfd737b2f55000003"], // 주소1
      "계약상대자 대표자명": ["6a543baffd737b2f55000004"], // 텍스트2 ("대표" 란)
      입금은행: ["6a543bdafd737b2f55000007"], // 텍스트4 (제3조 3항 아래, 다른 페이지)
      계좌번호: ["6a543beafd737b2f55000009"], // 텍스트5
      예금주: ["6a543bf0fd737b2f5500000a"], // 텍스트6
    },
  },
}

/**
 * "계약종류" select 속성값 -> 위드싸인 템플릿(form_id) 매핑. 사람이 form_id를
 * 직접 입력하지 않고 종류만 골라도 되도록 하기 위한 것 — 앞으로도 계속 재사용할
 * 일반 템플릿만 등록한다. 계약 1건짜리로 끝나는 문서(내용이 이미지에 고정 인쇄된
 * 과거 계약들)는 여기 넣지 않는다 — 새 계약엔 애초에 재사용할 수 없는 템플릿이라서다.
 * 키는 실제 Notion "계약종류" select 옵션명과 정확히 일치해야 한다.
 */
export const CONTRACT_TYPE_FORM_ID_MAP: Record<string, string> = {
  전시참여작가: "6a968f8c018f754b016eb79d", // v3 — 계약서양식 01_전시 참여 작가_v3
  입주청소: "6a585eb0365aa6b2d355f7dd",
  패키지디자인: "6a84000ed994df5b4d04aeeb",
}

/**
 * 시각적으로 아직 확인하지 못한 템플릿 (form/detail 상 TEXT/ADDRESS 필드가 있지만
 * 아직 배경 이미지를 열어 대조하지 않음). 이 목록의 form_id는 FORM_ITEM_MAP에 없어도
 * "매핑이 없다"가 아니라 "아직 검증 전"이라는 뜻이다. 확인된 최신 계약(수정본)들이
 * 필드 없는 방식으로 바뀐 것으로 보아, 아래 템플릿들은 재사용 가능성이 낮은 구버전일
 * 수 있다.
 */
export const UNVERIFIED_FORM_IDS: string[] = [
  "6a4c67ba2ac641b6536de2d0", // Be병점 개관전시 참여 계약서_오가음 1
]

/**
 * 필드가 전혀 없는(=계약 내용이 이미 문서 이미지에 인쇄되어 있는) 템플릿.
 * 이런 템플릿은 items로 채울 값이 없다 — 계약마다 값이 바뀌면 문서를 새로 만들어
 * 업로드해야 한다.
 */
export const NO_FILLABLE_FIELDS_FORM_IDS: string[] = [
  "6a9299b2018f754b016bd8ab", // Be병점 개관전시 참여 계약서_임희주X박재형수정본
  "6a923553f853ff6dda102d1f", // 비이닷병점 로컬 콜라보쌀과 포도 상품개발 협업 계약서
]

/**
 * DB 행(row)의 값으로 form/send에 넘길 items 배열을 만든다.
 * 매핑이 없는 form_id는 명시적으로 에러를 던진다 — 값을 엉뚱한 칸에 채우는 것보다
 * 실패하는 게 안전하다.
 */
export function buildSendItems(
  formId: string,
  row: Partial<Record<DbFieldKey, string>>,
): { id: string; value: string }[] {
  const mapping = FORM_ITEM_MAP[formId]
  if (!mapping) {
    if (NO_FILLABLE_FIELDS_FORM_IDS.includes(formId)) {
      return [] // 채울 필드 자체가 없는 템플릿
    }
    throw new Error(
      `템플릿 ${formId}의 필드 매핑이 없습니다. widsignTemplateDetail로 조회 후 배경 이미지를 대조해 FORM_ITEM_MAP에 추가하세요.`,
    )
  }

  const items: { id: string; value: string }[] = []
  for (const [key, itemIds] of Object.entries(mapping.fields)) {
    const value = row[key as DbFieldKey]
    if (value === undefined || itemIds === undefined) continue
    for (const itemId of itemIds) {
      items.push({ id: itemId, value })
    }
  }
  return items
}

/** widsignGet("/doc/detail", ...) 응답에서 필요한 부분만 뽑아 쓰는 최소 타입. */
interface DocDetailItem {
  id: string
  values: unknown
}
interface DocDetailPage {
  items: DocDetailItem[]
}
export interface DocDetailResult {
  result: { doc: DocDetailPage[] }
}

function itemValueToString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value
  if (value && typeof value === "object") {
    // ADDRESS 등 문자열이 아닌 필드 타입 대비 — 알려진 형태가 아니면 원본을 그대로 보존한다.
    return JSON.stringify(value)
  }
  return undefined
}

/**
 * 계약이 완료(END)된 뒤, 수신자가 직접 입력한 값(receiverFields)을 doc/detail
 * 응답에서 뽑아 DB에 반영할 수 있는 형태로 돌려준다. 매핑이 없으면 빈 객체를 반환한다.
 * 같은 DB 키에 매핑된 필드가 여러 개면 값이 채워진 첫 번째 필드를 사용한다.
 */
export function extractReceiverValues(
  formId: string,
  docDetail: DocDetailResult,
): Partial<Record<DbFieldKey, string>> {
  const mapping = FORM_ITEM_MAP[formId]?.receiverFields
  if (!mapping) return {}

  const itemsById = new Map<string, unknown>()
  for (const page of docDetail.result.doc) {
    for (const item of page.items) {
      itemsById.set(item.id, item.values)
    }
  }

  const result: Partial<Record<DbFieldKey, string>> = {}
  for (const [key, itemIds] of Object.entries(mapping)) {
    if (!itemIds) continue
    for (const itemId of itemIds) {
      const value = itemValueToString(itemsById.get(itemId))
      if (value !== undefined) {
        result[key as DbFieldKey] = value
        break
      }
    }
  }
  return result
}
