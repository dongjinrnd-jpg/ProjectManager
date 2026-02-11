/**
 * 고급 검색 관련 타입 정의
 *
 * PRD 3.9 고급 검색/필터 기능
 * - 복합 조건 검색
 * - 키워드 검색 (범위 선택)
 * - 검색 결과 정렬
 * - 검색 조건 저장 (즐겨찾기)
 */

import type { ProjectStage, ProjectStatus } from './project';

/**
 * 키워드 검색 범위
 */
export interface KeywordScope {
  /** 업무진행사항 검색 */
  content: boolean;
  /** 이슈사항 검색 */
  issue: boolean;
}

/**
 * 고급 검색 필터
 */
export interface AdvancedSearchFilter {
  /** 시작 날짜 (YYYY-MM-DD) */
  startDate?: string;
  /** 종료 날짜 (YYYY-MM-DD) */
  endDate?: string;
  /** 고객사 */
  customer?: string;
  /** 소속 (전장/유압/기타) */
  division?: string;
  /** 단계 */
  stage?: ProjectStage;
  /** 담당자 ID */
  assigneeId?: string;
  /** 진행여부 (프로젝트 상태) */
  status?: ProjectStatus;
  /** 키워드 */
  keyword?: string;
  /** 키워드 검색 범위 */
  keywordScope?: KeywordScope;
}

/**
 * 검색 정렬 필드
 */
export type SearchSortField = 'date' | 'project' | 'stage' | 'assignee' | 'customer';

/**
 * 검색 결과 정렬 옵션
 */
export interface SearchSortOption {
  /** 정렬 필드 */
  field: SearchSortField;
  /** 정렬 순서 */
  order: 'asc' | 'desc';
}

/**
 * 검색 결과 항목 (업무일지 기반 + 프로젝트 정보 조인)
 */
export interface SearchResultItem {
  /** 업무일지 ID */
  id: string;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 프로젝트 ID */
  projectId: string;
  /** ITEM명 */
  item: string;
  /** 고객사 */
  customer: string;
  /** 소속 */
  division: string;
  /** 단계 */
  stage: ProjectStage;
  /** 담당자 ID */
  assigneeId: string;
  /** 담당자 이름 */
  assigneeName: string;
  /** 업무 내용 */
  content: string;
  /** 계획 */
  plan?: string;
  /** 이슈사항 */
  issue?: string;
  /** 이슈 상태 */
  issueStatus?: 'open' | 'resolved';
  /** 프로젝트 상태 */
  projectStatus: ProjectStatus;
}

/**
 * 검색 결과 응답
 */
export interface SearchResponse {
  /** 검색 결과 목록 */
  items: SearchResultItem[];
  /** 전체 결과 수 */
  total: number;
  /** 현재 페이지 */
  page: number;
  /** 페이지 크기 */
  pageSize: number;
  /** 전체 페이지 수 */
  totalPages: number;
}

/**
 * 저장된 검색 조건 (Google Sheets: SavedSearches)
 */
export interface SavedSearch {
  /** 저장된 검색 ID (PK) - 예: SS-001 */
  id: string;
  /** 사용자 ID (FK → Users) */
  userId: string;
  /** 검색 조건 이름 */
  name: string;
  /** 필터 조건 (JSON 직렬화) */
  filtersJson: string;
  /** 생성일시 */
  createdAt: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 저장된 검색 (파싱된 형태)
 */
export interface SavedSearchParsed {
  /** 저장된 검색 ID */
  id: string;
  /** 사용자 ID */
  userId: string;
  /** 검색 조건 이름 */
  name: string;
  /** 필터 조건 (파싱됨) */
  filters: AdvancedSearchFilter;
  /** 생성일시 */
  createdAt: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 저장된 검색 생성 입력
 */
export interface CreateSavedSearchInput {
  /** 검색 조건 이름 */
  name: string;
  /** 필터 조건 */
  filters: AdvancedSearchFilter;
}
