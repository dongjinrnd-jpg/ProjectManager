/**
 * 주간 보고서 날짜 관련 유틸리티
 *
 * - 한국 시간대 (KST, UTC+9) 기준
 * - 월-금 근무일 체계
 */

/**
 * 한국 시간대(KST, UTC+9) 기준 현재 날짜 반환
 */
export function getKoreanDate(): Date {
  const now = new Date();
  // UTC 시간에 9시간 추가하여 한국 시간 계산
  const koreaOffset = 9 * 60; // 분 단위
  const localOffset = now.getTimezoneOffset();
  const koreanTime = new Date(now.getTime() + (koreaOffset + localOffset) * 60 * 1000);
  return koreanTime;
}

/**
 * 해당 월의 첫 번째 월요일 찾기
 * - 월의 1일이 월요일이면 그 날
 * - 아니면 그 다음 월요일
 */
export function getFirstMondayOfMonth(year: number, month: number): Date {
  const firstDay = new Date(year, month - 1, 1);
  const dayOfWeek = firstDay.getDay(); // 0=일, 1=월, ..., 6=토

  // 월요일까지 며칠 남았는지 계산
  // dayOfWeek가 0(일)이면 1일 후, 1(월)이면 0일, 2(화)이면 6일 후...
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);

  const firstMonday = new Date(year, month - 1, 1 + daysUntilMonday);
  return firstMonday;
}

/**
 * 주차 계산 (월-금 근무 기준)
 * - 1주차: 해당 월의 첫 번째 월요일이 속한 주
 * - 해당 날짜가 첫 번째 월요일 이전이면 1주차로 처리
 */
export function getWeekOfMonth(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const firstMonday = getFirstMondayOfMonth(year, month);

  // 현재 날짜가 첫 번째 월요일 이전이면 1주차
  if (date < firstMonday) {
    return 1;
  }

  // 첫 번째 월요일로부터 며칠 지났는지 계산
  const diffTime = date.getTime() - firstMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // 7일 단위로 주차 계산
  return Math.floor(diffDays / 7) + 1;
}

/**
 * 해당 주차의 월-금 범위 계산
 */
export function getWeekRange(year: number, month: number, week: number): { start: Date; end: Date } {
  const firstMonday = getFirstMondayOfMonth(year, month);

  // N주차의 월요일 계산
  const start = new Date(firstMonday);
  start.setDate(firstMonday.getDate() + (week - 1) * 7);

  // 금요일 계산 (월요일 + 4일)
  const end = new Date(start);
  end.setDate(start.getDate() + 4);

  return { start, end };
}

/**
 * 해당 월의 총 주차 수 계산
 */
export function getTotalWeeksInMonth(year: number, month: number): number {
  const firstMonday = getFirstMondayOfMonth(year, month);
  const lastDay = new Date(year, month, 0); // 해당 월의 마지막 날

  // 마지막 날이 몇 주차에 속하는지 계산
  const diffTime = lastDay.getTime() - firstMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(1, Math.floor(diffDays / 7) + 1);
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