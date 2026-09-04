/**
 * Notion Public API 페이지 속성(PageObjectResponse.properties)에서 값을 꺼내는
 * 최소한의 타입 안전 헬퍼. 공식 @notionhq/client의 전체 타입을 쓰지 않고
 * 필요한 속성 타입만 느슨하게 다룬다.
 */

// biome-ignore lint: Notion 속성 값은 타입별로 모양이 달라 any로 다룬다.
type PropertyValue = any

export function getTitle(props: Record<string, PropertyValue>, key: string): string | undefined {
  const p = props[key]
  if (p?.type !== "title") return undefined
  const text = p.title.map((t: { plain_text: string }) => t.plain_text).join("")
  return text || undefined
}

export function getText(props: Record<string, PropertyValue>, key: string): string | undefined {
  const p = props[key]
  if (p?.type !== "rich_text") return undefined
  const text = p.rich_text.map((t: { plain_text: string }) => t.plain_text).join("")
  return text || undefined
}

export function getEmail(props: Record<string, PropertyValue>, key: string): string | undefined {
  const p = props[key]
  if (p?.type !== "email") return undefined
  return p.email ?? undefined
}

export function getPhone(props: Record<string, PropertyValue>, key: string): string | undefined {
  const p = props[key]
  if (p?.type !== "phone_number") return undefined
  return p.phone_number ?? undefined
}

export function getSelect(props: Record<string, PropertyValue>, key: string): string | undefined {
  const p = props[key]
  if (p?.type !== "select") return undefined
  return p.select?.name ?? undefined
}

export function getStatus(props: Record<string, PropertyValue>, key: string): string | undefined {
  const p = props[key]
  if (p?.type !== "status") return undefined
  return p.status?.name ?? undefined
}

export function getNumber(props: Record<string, PropertyValue>, key: string): number | undefined {
  const p = props[key]
  if (p?.type !== "number") return undefined
  return p.number ?? undefined
}

export function getDate(
  props: Record<string, PropertyValue>,
  key: string,
): { start: string; end: string | null } | undefined {
  const p = props[key]
  if (p?.type !== "date" || !p.date) return undefined
  return { start: p.date.start, end: p.date.end ?? null }
}

export function hasFiles(props: Record<string, PropertyValue>, key: string): boolean {
  const p = props[key]
  if (p?.type !== "files") return false
  return Array.isArray(p.files) && p.files.length > 0
}

/** Notion rich_text 속성 업데이트 값을 만든다 (notion.pages.update용). */
export function richText(text: string) {
  return { rich_text: [{ text: { content: text.slice(0, 2000) } }] }
}
