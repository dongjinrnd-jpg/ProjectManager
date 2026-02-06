/**
 * 업무일지 관련 타입 정의
 * Google Sheets: WorkLogs 시트
 */

import type { ProjectStage } from './project';

/**
 * 업무일지 기본 정보
 */
export interface WorkLog {
  /** 업무일지 ID (PK) - 예: WL-20260202-001 */
  id: string;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 프로젝트 ID (FK → Projects) */
  projectId: string;
  /** ITEM명 (프로젝트에서 가져옴) */
  item: string;
  /** 고객사 (프로젝트에서 가져옴) */
  customer: string;
  /** 단계 */
  stage: ProjectStage;
  /** 담당자 ID (FK → Users) - 작성자 */
  assigneeId: string;
  /** 참여자 IDs (쉼표 구분) - 함께 작업한 팀원 */
  participants?: string;
  /** 계획 */
  plan?: string;
  /** 업무 내용 */
  content: string;
  /** 이슈사항 */
  issue?: string;
  /** 이슈사항 상태 */
  issueStatus?: 'open' | 'resolved';
  /** 이슈사항 해결일시 */
  issueResolvedAt?: string;
  /** 세부추진항목 ID (FK → ProjectSchedules) - 실적 자동 연동용 */
  scheduleId?: string;
  /** 생성일시 */
  createdAt: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 업무일지 생성 입력 타입
 */
export interface CreateWorkLogInput {
  date: string;
  projectId: string;
  stage: ProjectStage;
  plan?: string;
  content: string;
  /** 참여자 IDs (쉼표 구분) */
  participants?: string;
  /** 이슈사항 */
  issue?: string;
  /** 세부추진항목 ID (FK → ProjectSchedules) - 실적 자동 연동용 */
  scheduleId?: string;
}

/**
 * 업무일지 수정 입력 타입
 */
export interface UpdateWorkLogInput {
  date?: string;
  projectId?: string;
  stage?: ProjectStage;
  plan?: string;
  content?: string;
  /** 참여자 IDs (쉼표 구분) */
  participants?: string;
  /** 이슈사항 */
  issue?: string;
  /** 이슈사항 상태 */
  issueStatus?: 'open' | 'resolved';
  /** 세부추진항목 ID (FK → ProjectSchedules) - 실적 자동 연동용 */
  scheduleId?: string;
}

/**
 * 업무일지 검색 필터
 */
export interface WorkLogFilter {
  /** 시작 날짜 */
  startDate?: string;
  /** 종료 날짜 */
  endDate?: string;
  /** 프로젝트 ID */
  projectId?: string;
  /** 담당자 ID */
  assigneeId?: string;
  /** 단계 */
  stage?: ProjectStage;
  /** 키워드 검색 (내용) */
  keyword?: string;
}