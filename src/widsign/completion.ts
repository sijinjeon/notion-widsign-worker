/**
 * 계약 완료 후 처리 공용 로직 — "발송 후 완료 감지"를 트리거하는 경로가
 * 여러 개(웹훅, 스케줄된 sync)이므로, 실제 처리 로직은 여기 한 곳에 모아
 * 재사용한다.
 */
import type { Client } from "@notionhq/client"
import JSZip from "jszip"
import * as widsign from "./api.js"
import { extractReceiverValues, type DocDetailResult } from "./fieldMapping.js"
import { richText } from "../notion/properties.js"

/** 완료 계약서 zip(contract.pdf + certificate.pdf)을 받아 Notion 파일 속성에 첨부한다. */
export async function attachSignedDocument(notion: Client, pageId: string, receiverMetaId: string) {
  const buffer = await widsign.downloadDocRaw(receiverMetaId)
  const zip = await JSZip.loadAsync(buffer)

  async function uploadEntry(entryName: string, filename: string): Promise<string | null> {
    const entry = zip.file(entryName)
    if (!entry) return null
    const data = await entry.async("arraybuffer")
    const upload = await notion.fileUploads.create({ filename, content_type: "application/pdf" })
    await notion.fileUploads.send({
      file_upload_id: upload.id,
      file: { filename, data: new Blob([data], { type: "application/pdf" }) },
    })
    return upload.id
  }

  const contractUploadId = await uploadEntry("contract.pdf", "완료_계약서.pdf")
  const certificateUploadId = await uploadEntry("certificate.pdf", "감사추적인증서.pdf")

  const properties: Record<string, { type: "file_upload"; file_upload: { id: string } }[]> = {}
  if (contractUploadId) {
    properties["완료 계약서"] = [{ type: "file_upload", file_upload: { id: contractUploadId } }]
  }
  if (certificateUploadId) {
    properties["감사추적인증서"] = [{ type: "file_upload", file_upload: { id: certificateUploadId } }]
  }
  if (Object.keys(properties).length > 0) {
    // biome-ignore lint: Notion 공식 SDK 타입과 정확히 맞추기보다 최소한으로 캐스팅한다.
    await notion.pages.update({ page_id: pageId, properties: properties as any })
  }

  return {
    attachedContract: Boolean(contractUploadId),
    attachedCertificate: Boolean(certificateUploadId),
  }
}

export interface SyncCompletedContractOptions {
  /** 진행상태/API 상태 코드/완료일시 등을 쓸 Notion 속성명 (프로젝트마다 다를 수 있어 주입) */
  properties?: {
    progressStatus?: string
    progressStatusCompleteValue?: string
    apiStatusCode?: string
    completedAt?: string
    lastSyncedAt?: string
    apiNote?: string
  }
}

const DEFAULT_PROPERTY_NAMES: Required<NonNullable<SyncCompletedContractOptions["properties"]>> = {
  progressStatus: "진행상태",
  progressStatusCompleteValue: "완료",
  apiStatusCode: "API 상태 코드",
  completedAt: "완료일시",
  lastSyncedAt: "최근 동기화",
  apiNote: "API 메모",
}

/**
 * 완료된 계약 하나를 처리한다: 계약서/인증서 첨부 + 수신자 입력값 회수 +
 * 진행상태·완료일시 등 갱신. 실패하면 그대로 throw한다 — 호출자가 로그/재시도
 * 정책을 결정한다.
 */
export async function syncCompletedContract(
  notion: Client,
  pageId: string,
  formId: string,
  receiverMetaId: string,
  options: SyncCompletedContractOptions = {},
) {
  const p = { ...DEFAULT_PROPERTY_NAMES, ...options.properties }

  const { attachedContract, attachedCertificate } = await attachSignedDocument(notion, pageId, receiverMetaId)

  const detail = (await widsign.getDocDetail(receiverMetaId)) as unknown as DocDetailResult
  const receiverValues = extractReceiverValues(formId, detail)
  const receiverProperties: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(receiverValues)) {
    receiverProperties[key] = richText(value)
  }

  const now = new Date().toISOString()
  const properties: Record<string, unknown> = {
    ...receiverProperties,
    [p.progressStatus]: { status: { name: p.progressStatusCompleteValue } },
    [p.apiStatusCode]: { select: { name: "END" } },
    [p.completedAt]: { date: { start: now } },
    [p.lastSyncedAt]: { date: { start: now } },
    [p.apiNote]: richText(
      `자동 동기화 완료 (계약서: ${attachedContract ? "첨부됨" : "없음"}, ` +
        `인증서: ${attachedCertificate ? "첨부됨" : "없음"})`,
    ),
  }
  // biome-ignore lint: Notion 공식 SDK 타입과 정확히 맞추기보다 최소한으로 캐스팅한다.
  await notion.pages.update({ page_id: pageId, properties: properties as any })

  return { attachedContract, attachedCertificate }
}
