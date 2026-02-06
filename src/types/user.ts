/**
 * 사용자 관련 타입 정의
 * Google Sheets: Users 시트
 */

/**
 * 사용자 권한 (5단계)
 * - sysadmin: 시스템 관리자 (사용자/시스템 관리 전용)
 * - executive: 경영진 (조회 전용 + 코멘트)
 * - admin: 관리자 (모든 권한)
 * - engineer: 개발팀 직원 (프로젝트/업무일지 전체 권한)
 * - user: 일반 사용자 (프로젝트 조회만, 업무일지 접근 불가)
 */
export type UserRole = 'sysadmin' | 'executive' | 'admin' | 'engineer' | 'user';

/**
 * 소속 구분
 */
export type Division = '전장' | '유압' | '기타';

/**
 * 사용자 기본 정보
 */
export interface User {
  /** 사용자 ID (PK, 로그인 ID) - 예: admin001 */
  id: string;
  /** 비밀번호 (bcrypt 해시) */
  password: string;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 권한 */
  role: UserRole;
  /** 소속 */
  division: Division;
  /** 활성화 여부 */
  isActive: boolean;
  /** 생성일시 */
  createdAt: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 사용자 생성 입력 타입
 */
export interface CreateUserInput {
  id: string;
  password: string;
  name: string;
  email?: string;
  role: UserRole;
  division: Division;
}

/**
 * 사용자 수정 입력 타입
 */
export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  division?: Division;
  isActive?: boolean;
}

/**
 * 로그인 입력 타입
 */
export interface LoginInput {
  id: string;
  password: string;
}

/**
 * 인증된 사용자 세션 정보
 */
export interface AuthSession {
  user: Omit<User, 'password'>;
  /** 세션 만료 시간 */
  expiresAt: string;
}