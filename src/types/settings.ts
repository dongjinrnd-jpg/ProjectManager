/**
 * 시스템 설정 관련 타입 정의
 * Google Sheets: Settings, ReportCategories 시트
 */

/**
 * 주간 보고 구분 (마스터)
 */
export interface ReportCategory {
  /** 구분 ID (PK) - 예: CAT-001 */
  id: string;
  /** 구분명 */
  name: string;
  /** 표시 순서 */
  order: number;
  /** 활성화 여부 */
  isActive: boolean;
}

/**
 * 시스템 설정
 */
export interface Setting {
  /** 설정 키 (PK) */
  key: string;
  /** 설정 값 (JSON string) */
  value: string;
  /** 설명 */
  description?: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 주요 설정 키
 */
export type SettingKey =
  | 'project_columns'        // 프로젝트 목록 표시 컬럼
  | 'default_page_size'      // 기본 페이지당 항목 수
  | 'date_format'            // 날짜 표시 형식
  | 'available_stages'       // 사용 가능한 단계 목록
  | 'available_divisions'    // 사용 가능한 소속 목록
  | 'available_categories';  // 사용 가능한 관련부문 목록

/**
 * 프로젝트 목록 컬럼 설정
 */
export type ProjectColumn =
  | 'customer'
  | 'item'
  | 'division'
  | 'category'
  | 'model'
  | 'partNo'
  | 'teamLeaderId'
  | 'teamMembers'
  | 'currentStage'
  | 'status'
  | 'scheduleStart'
  | 'scheduleEnd'
  | 'progress'
  | 'issues';

/**
 * 설정 값 타입 (파싱 후)
 */
export interface ParsedSettings {
  projectColumns: ProjectColumn[];
  defaultPageSize: number;
  dateFormat: string;
  availableStages: string[];
  availableDivisions: string[];
  availableCategories: string[];
}
