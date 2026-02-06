/**
 * 프로젝트 관련 타입 정의
 * Google Sheets: Projects, ProjectHistory, Favorites 시트
 */

/**
 * 프로젝트 상태
 */
export type ProjectStatus = '진행중' | '보류' | '완료';

/**
 * 개발 단계 (14개)
 */
export type ProjectStage =
  | '검토'
  | '설계'
  | '개발'
  | 'PROTO'
  | '신뢰성'
  | 'P1'
  | 'P2'
  | '승인'
  | '양산이관'
  | '초도양산'
  | '품질관리'
  | '원가절감'
  | '품질개선'
  | '설계변경';

/**
 * 주간 보고 구분 (카테고리)
 */
export type ReportCategoryName = '농기' | '중공업' | '해외' | '기타';

/**
 * 프로젝트 기본 정보
 */
export interface Project {
  /** 프로젝트 ID (PK) - 예: PRJ-2026-001 */
  id: string;
  /** 진행 상태 */
  status: ProjectStatus;
  /** 고객사 */
  customer: string;
  /** 소속 (전장/유압/기타) */
  division: string;
  /** 구분 (주간보고용) */
  category: string;
  /** 모델 */
  model?: string;
  /** ITEM명 */
  item: string;
  /** PART NO */
  partNo?: string;
  /** 팀장 ID (FK → Users) */
  teamLeaderId: string;
  /** 팀원 IDs (쉼표 구분) */
  teamMembers?: string;
  /** 현재 단계 */
  currentStage: ProjectStage;
  /** 선택된 단계 목록 (쉼표 구분) */
  stages: string;
  /** 업무진행사항 */
  progress?: string;
  /** 이슈사항 */
  issues?: string;
  /** 대일정 시작 (YYYY-MM-DD) */
  scheduleStart: string;
  /** 대일정 종료 (YYYY-MM-DD) */
  scheduleEnd: string;
  /** 비고 */
  note?: string;
  /** 생성일시 */
  createdAt: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 프로젝트 생성 입력 타입
 */
export interface CreateProjectInput {
  customer: string;
  item: string;
  teamLeaderId: string;
  scheduleStart: string;
  scheduleEnd: string;
  division?: string;
  category?: string;
  model?: string;
  partNo?: string;
  teamMembers?: string;
  stages: string[];
  note?: string;
}

/**
 * 프로젝트 수정 입력 타입
 */
export interface UpdateProjectInput {
  status?: ProjectStatus;
  customer?: string;
  division?: string;
  category?: string;
  model?: string;
  item?: string;
  partNo?: string;
  teamLeaderId?: string;
  teamMembers?: string;
  currentStage?: ProjectStage;
  stages?: string;
  progress?: string;
  issues?: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  note?: string;
}

/**
 * 프로젝트 이력
 */
export interface ProjectHistory {
  /** 이력 ID (PK) - 예: PH-001 */
  id: string;
  /** 프로젝트 ID (FK) */
  projectId: string;
  /** 변경된 필드 */
  changedField: string;
  /** 이전 값 */
  oldValue?: string;
  /** 새 값 */
  newValue: string;
  /** 변경자 ID (FK → Users) */
  changedById: string;
  /** 변경일시 */
  changedAt: string;
}

/**
 * 즐겨찾기
 */
export interface Favorite {
  /** 즐겨찾기 ID (PK) - 예: FAV-001 */
  id: string;
  /** 사용자 ID (FK → Users) */
  userId: string;
  /** 프로젝트 ID (FK → Projects) */
  projectId: string;
  /** 등록일시 */
  createdAt: string;
}