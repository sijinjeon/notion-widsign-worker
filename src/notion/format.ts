/** 숫자 -> 한글 금액 표기 (법률/계약서용 관례: 자릿수 생략 없이 "일백만원정" 형태) */
const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"]
const SMALL_UNITS = ["", "십", "백", "천"]
const BIG_UNITS = ["", "만", "억", "조"]

function convertGroup(num: number): string {
  let result = ""
  const str = String(num)
  for (let i = 0; i < str.length; i++) {
    const digit = Number(str[i])
    if (digit === 0) continue
    const unitIndex = str.length - i - 1
    result += DIGITS[digit] + SMALL_UNITS[unitIndex]
  }
  return result
}

export function numberToKoreanWon(amount: number): string {
  const won = Math.round(amount)
  if (won === 0) return `금 영원정(₩0원)`

  let num = won
  const groups: number[] = []
  while (num > 0) {
    groups.push(num % 10000)
    num = Math.floor(num / 10000)
  }

  let words = ""
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    words += convertGroup(groups[i]) + BIG_UNITS[i]
  }

  return `금 ${words}원정(₩${won.toLocaleString("ko-KR")}원)`
}

/** "YYYY-MM-DD" 형식으로 변환 (시간 정보는 버림). */
export function formatDate(isoDate: string): string {
  return isoDate.slice(0, 10)
}

/** 시작일만 있으면 단일 날짜, 종료일까지 있으면 "시작 ~ 종료" 범위로 표기. */
export function formatDateRange(start: string, end: string | null): string {
  if (!end) return formatDate(start)
  return `${formatDate(start)} ~ ${formatDate(end)}`
}
