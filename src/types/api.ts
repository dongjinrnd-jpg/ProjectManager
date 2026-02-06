/**
 * API 응답 관련 타입 정의
 */

/**
 * API 기본 응답
 */
export interface ApiResponse<T = unknown> {
  /** 성공 여부 */
  success: boolean;
  /** 응답 데이터 */
  data?: T;
  /** 에러 메시지 */
  error?: string;
  /** 에러 코드 */
  errorCode?: string;
}

/**
 * 페이지네이션 요청
 */
export interface PaginationRequest {
  /** 페이지 번호 (1부터 시작) */
  page: number;
  /** 페이지당 항목 수 */
  pageSize: number;
  /** 정렬 필드 */
  sortBy?: string;
  /** 정렬 방향 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
  /** 데이터 목록 */
  items: T[];
  /** 전체 항목 수 */
  total: number;
  /** 현재 페이지 */
  page: number;
  /** 페이지당 항목 수 */
  pageSize: number;
  /** 전체 페이지 수 */
  totalPages: number;
  /** 다음 페이지 존재 여부 */
  hasNext: boolean;
  /** 이전 페이지 존재 여부 */
  hasPrev: boolean;
}

/**
 * 에러 코드
 */
export type ApiErrorCode =
  | 'UNAUTHORIZED'          // 인증 필요
  | 'FORBIDDEN'             // 권한 없음
  | 'NOT_FOUND'             // 리소스 없음
  | 'VALIDATION_ERROR'      // 입력값 검증 실패
  | 'DUPLICATE_ENTRY'       // 중복 데이터
  | 'SHEETS_API_ERROR'      // Google Sheets API 에러
  | 'INTERNAL_ERROR';       // 서버 내부 에러

/**
 * API 에러 상세
 */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, string>;
}

/**
 * 목록 조회 공통 쿼리
 */
export interface ListQuery extends PaginationRequest {
  /** 검색 키워드 */
  search?: string;
  /** 필터 (JSON string) */
  filter?: string;
}