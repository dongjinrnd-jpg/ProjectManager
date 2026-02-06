/**
 * 세부추진항목 (일정) 관련 타입 정의
 * Google Sheets: ProjectSchedules 시트
 */

/**
 * 세부추진항목 상태
 */
export type ScheduleStatus = 'planned' | 'in_progress' | 'completed' | 'delayed';

/**
 * 업무 구분 (주관/협조)
 */
export type Responsibility = 'lead' | 'support';

/**
 * 관련 부문
 */
export type ScheduleCategory = '영업' | '생산' | '구매' | '품질' | '설계';

/**
 * 세부추진항목 (개별 일정)
 */
export interface ProjectSchedule {
  /** 일정 ID (PK) - 예: PS-001 */
  id: string;
  /** 프로젝트 ID (FK → Projects) */
  projectId: string;
  /** 프로젝트 단계 (검토, 설계, 개발 등) */
  stage?: string;
  /** 세부추진항목명 */
  taskName: string;
  /** 관련 부문 */
  category?: ScheduleCategory;
  /** 주관/협조 */
  responsibility?: Responsibility;
  /** 계획 시작일 (YYYY-MM-DD) */
  plannedStart: string;
  /** 계획 종료일 (YYYY-MM-DD) */
  plannedEnd: string;
  /** 실적 시작일 (YYYY-MM-DD) */
  actualStart?: string;
  /** 실적 종료일 (YYYY-MM-DD) */
  actualEnd?: string;
  /** 상태 */
  status: ScheduleStatus;
  /** 비고 */
  note?: string;
  /** 표시 순서 */
  order: number;
}

/**
 * 세부추진항목 생성 입력 타입
 */
export interface CreateScheduleInput {
  projectId: string;
  stage?: string;
  taskName: string;
  category?: ScheduleCategory;
  responsibility?: Responsibility;
  plannedStart: string;
  plannedEnd: string;
  note?: string;
}

/**
 * 세부추진항목 수정 입력 타입
 */
export interface UpdateScheduleInput {
  stage?: string;
  taskName?: string;
  category?: ScheduleCategory;
  responsibility?: Responsibility;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  status?: ScheduleStatus;
  note?: string;
  order?: number;
}

/**
 * 간트차트 데이터 (뷰용)
 */
export interface GanttChartItem {
  id: string;
  name: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  status: ScheduleStatus;
  progress: number;
}