import { Worker } from "@notionhq/workers"

/**
 * 단일 Worker 인스턴스. index.ts와 다른 capability 등록 파일(예: src/sync/*)이
 * 전부 이 모듈에서 worker를 가져와 자신의 tool/webhook/sync를 등록한다.
 * (index.ts에서 직접 `new Worker()`를 만들고 다른 파일이 그걸 다시 import하면
 * 순환참조가 생기므로, 인스턴스 생성만 이 파일로 분리했다.)
 */
export const worker = new Worker()
export default worker
