/**
 * 주간 보고서 날짜 관련 유틸리티
 *
 * - 한국 시간대 (KST, UTC+9) 기준
 * - 월-금 근무일 체계
 * - ISO 8601 목요일 규칙: 주의 목요일이 속한 달이 그 주의 소속 달
 *   → 1주차 = 해당 월의 첫 번째 목요일이 포함된 주
 */

/**
 * 한국 시간대(KST, UTC+9) 기준 현재 날짜 반환
 */
export function getKoreanDate(): Date {
  const now = new Date();
  const koreaOffset = 9 * 60;
  const localOffset = now.getTimezoneOffset();
  const koreanTime = new Date(now.getTime() + (koreaOffset + localOffset) * 60 * 1000);
  return koreanTime;
}

/**
 * 해당 월 1주차의 월요일 반환 (ISO 목요일 규칙)
 * - 해당 월의 첫 번째 목요일이 포함된 주의 월요일
 * - 1일이 금/토/일이면 1주차의 월요일은 전월에 위치
 */
export function getFirstMondayOfMonth(year: number, month: number): Date {
  const firstDay = new Date(year, month - 1, 1);
  const dayOfWeek = firstDay.getDay(); // 0=일, 1=월, ..., 4=목, 5=금, 6=토

  // 해당 월의 첫 번째 목요일까지의 일 수
  let daysUntilThursday: number;
  if (dayOfWeek === 0) {
    daysUntilThursday = 4; // 일 → +4일
  } else if (dayOfWeek <= 4) {
    daysUntilThursday = 4 - dayOfWeek; // 월~목
  } else {
    daysUntilThursday = 11 - dayOfWeek; // 금=6일, 토=5일
  }

  const firstThursday = new Date(year, month - 1, 1 + daysUntilThursday);
  // 1주차 월요일 = 첫 번째 목요일 - 3일
  const firstMonday = new Date(firstThursday);
  firstMonday.setDate(firstThursday.getDate() - 3);
  return firstMonday;
}

/**
 * 주어진 날짜가 속한 주의 월요일 반환
 */
function getMondayOfWeek(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0=일, ..., 6=토
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(date.getDate() - daysToMonday);
  return monday;
}

/**
 * 주어진 날짜가 속한 주의 소속 연/월/주차를 반환 (ISO 목요일 규칙)
 * - 주의 목요일이 속한 달이 소속 달
 * - 5월 1일(금)처럼 월 경계에 걸친 날짜는 4월 5주차로 분류됨
 */
export function getYearMonthWeek(date: Date): { year: number; month: number; week: number } {
  const monday = getMondayOfWeek(date);
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);

  const year = thursday.getFullYear();
  const month = thursday.getMonth() + 1;

  const firstMonday = getFirstMondayOfMonth(year, month);
  const diffDays = Math.floor((monday.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;

  return { year, month, week };
}

/**
 * 주차 계산 (ISO 목요일 규칙 적용)
 * - 반환되는 주차는 해당 날짜가 속한 주의 소속 달 기준
 */
export function getWeekOfMonth(date: Date): number {
  return getYearMonthWeek(date).week;
}

/**
 * 해당 주차의 월-금 범위 계산
 */
export function getWeekRange(year: number, month: number, week: number): { start: Date; end: Date } {
  const firstMonday = getFirstMondayOfMonth(year, month);

  const start = new Date(firstMonday);
  start.setDate(firstMonday.getDate() + (week - 1) * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 4);

  return { start, end };
}

/**
 * 해당 월의 총 주차 수 계산 (ISO 목요일 규칙)
 * - 해당 월의 마지막 목요일이 속한 주의 주차 번호
 */
export function getTotalWeeksInMonth(year: number, month: number): number {
  const lastDay = new Date(year, month, 0); // 해당 월의 마지막 날
  // 마지막 날이 속한 주의 목요일 기준으로 owning month를 판정
  const info = getYearMonthWeek(lastDay);
  if (info.year === year && info.month === month) {
    return info.week;
  }
  // 마지막 날이 다음 달 1주차에 속한 경우 → 직전 날짜 기준으로 계산
  const prevDay = new Date(lastDay);
  prevDay.setDate(lastDay.getDate() - 1);
  const prevInfo = getYearMonthWeek(prevDay);
  return prevInfo.week;
}

/**
 * 날짜를 YYYY-MM-DD 형식 문자열로 변환
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 날짜 문자열을 M/D 형식으로 표시
 */
export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 날짜를 한국어 형식으로 표시 (M월 D일)
 */
export function formatDateKorean(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
