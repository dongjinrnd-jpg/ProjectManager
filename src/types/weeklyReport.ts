/**
 * 주간 보고 관련 타입 정의
 * Google Sheets: WeeklyReports, WeeklyReportNotices, WeeklyReportSummary 시트
 */

/**
 * 주간 보고 기본 정보
 */
export interface WeeklyReport {
  /** 주간보고 ID (PK) - 예: WR-2026-02-1-001 */
  id: string;
  /** 연도 */
  year: number;
  /** 월 */
  month: number;
  /** 주차 */
  week: number;
  /** 주 시작일 (YYYY-MM-DD) */
  weekStart: string;
  /** 주 종료일 (YYYY-MM-DD) */
  weekEnd: string;
  /** 구분 ID (FK → ReportCategories) */
  categoryId: string;
  /** 고객사 */
  customer: string;
  /** 개발 ITEM */
  item: string;
  /** 프로젝트 ID (FK → Projects, 선택) */
  projectId?: string;
  /** 주요 추진 실적 및 계획 */
  content: string;
  /** 표시 순서 */
  order: number;
  /** 작성자 ID (FK → Users) */
  createdById: string;
  /** 생성일시 */
  createdAt: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 주간 보고 생성 입력 타입
 */
export interface CreateWeeklyReportInput {
  year: number;
  month: number;
  week: number;
  weekStart: string;
  weekEnd: string;
  categoryId: string;
  customer: string;
  item: string;
  projectId?: string;
  content: string;
}

/**
 * 주간 보고 수정 입력 타입
 */
export interface UpdateWeeklyReportInput {
  categoryId?: string;
  customer?: string;
  item?: string;
  projectId?: string;
  content?: string;
  order?: number;
}

/**
 * 주간 보고 공지사항
 */
export interface WeeklyReportNotice {
  /** 공지 ID (PK) - 예: WRN-2026-02-1 */
  id: string;
  /** 연도 */
  year: number;
  /** 월 */
  month: number;
  /** 주차 */
  week: number;
  /** 공지 내용 */
  content: string;
  /** 작성자 ID (FK → Users) */
  createdById: string;
  /** 생성일시 */
  createdAt: string;
}

/**
 * 주간 보고 요약
 */
export interface WeeklyReportSummary {
  /** 요약 ID (PK) - 예: WRS-2026-02-1 */
  id: string;
  /** 연도 */
  year: number;
  /** 월 */
  month: number;
  /** 주차 */
  week: number;
  /** 요약 내용 */
  content: string;
  /** AI 생성 여부 */
  isAiGenerated: boolean;
  /** 생성일시 */
  createdAt: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 주간 보고 필터
 */
export interface WeeklyReportFilter {
  year?: number;
  month?: number;
  week?: number;
  categoryId?: string;
}