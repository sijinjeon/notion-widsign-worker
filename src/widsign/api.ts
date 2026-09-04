/**
 * 위드싸인 API 래퍼.
 *
 * 계약 발송(form/send)은 2026-09-01 사용자 승인 후 구현했다. 재발송/취소 등
 * 나머지 실제 계약에 영향을 주는 엔드포인트(POST /doc/resend, PUT /doc/cancel 등)는
 * 별도 승인 전까지 여전히 구현하지 않는다.
 */

import { widsignGet, widsignGetArrayBuffer, widsignGetBinary, widsignPost, type JSONValue } from "./client.js"

export interface CreditInfo extends Record<string, JSONValue> {
  svc_owner_id: number
  remain_credit: number
  remain_api_credit: number
}

export function getCredit(): Promise<CreditInfo> {
  return widsignGet<CreditInfo>("/service/credit")
}

export interface FormListParams extends Record<string, string | number | undefined> {
  page?: number
  page_size?: number
  title?: string
  group_id?: number
}

export function listForms(params: FormListParams = {}) {
  return widsignGet("/form", params)
}

export function getFormDetail(form_id: string) {
  return widsignGet("/form/detail", { form_id })
}

export type DocStatus = "SEND" | "WRITING" | "CANCEL" | "REJECT" | "EXPIRATION" | "END"

export interface DocListParams extends Record<string, string | number | undefined> {
  page?: number
  page_size?: number
  status?: DocStatus
  receiver_name?: string
  receiver_email?: string
  send_id?: number
}

export function listDocs(params: DocListParams = {}) {
  return widsignGet("/doc", params)
}

export function getDocDetail(receiver_meta_id: string) {
  return widsignGet("/doc/detail", { receiver_meta_id })
}

/** 완료된 계약서 사본(zip: PDF + 감사추적인증서)을 base64로 받아온다. */
export function downloadDoc(receiver_meta_id: string) {
  return widsignGetBinary("/doc/download", { receiver_meta_id })
}

/** 완료된 계약서 사본(zip)을 ArrayBuffer로 받아온다 (Notion 업로드 등 Worker 내부 처리용). */
export function downloadDocRaw(receiver_meta_id: string) {
  return widsignGetArrayBuffer("/doc/download", { receiver_meta_id })
}

/** 서비스 그룹(하위 조직) 목록 — 계정에 그룹이 여러 개인 경우 진단용. */
export function listServiceGroups() {
  return widsignGet("/service/group")
}

/** 서비스 멤버(팀원) 목록 — 계정에 다른 발송 계정이 있는지 진단용. */
export function listServiceMembers() {
  return widsignGet("/service/member")
}

export interface SendReceiver {
  name: string
  email: string
  mobile?: string
}

export interface SendFormParams {
  form_id: string
  title: string
  send_type: "SAMETIME" | "SEQUENTIAL"
  receiver_list: SendReceiver[]
  items?: { id: string; value: string }[]
  expiration_date?: string
}

/**
 * 계약서를 실제로 발송한다 (POST /form/send). 이메일/문자가 실제로 발송되고
 * 위드싸인 크레딧을 소모하는 되돌릴 수 없는 동작이다.
 */
export function sendForm(params: SendFormParams) {
  return widsignPost("/form/send", params as unknown as Record<string, JSONValue>)
}
