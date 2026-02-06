/**
 * 인증/권한 관련 헬퍼 함수
 */

import { auth } from '@/auth';
import type { UserRole } from '@/types';

/**
 * 현재 세션을 가져옵니다.
 */
export async function getSession() {
  return await auth();
}

/**
 * 사용자가 특정 권한을 가지고 있는지 확인합니다.
 */
export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * 권한 계층 (숫자가 높을수록 더 높은 권한)
 * - user: 일반 (조회만)
 * - engineer: 개발팀 (실무 권한)
 * - admin: 관리자 (모든 권한)
 * - executive: 경영진 (조회 + 코멘트)
 * - sysadmin: 시스템 관리자
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  engineer: 2,
  admin: 3,
  executive: 4,
  sysadmin: 5,
};

/**
 * 사용자의 권한이 최소 요구 권한 이상인지 확인합니다.
 */
export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/**
 * 관리자 권한 (admin, sysadmin)인지 확인합니다.
 */
export function isAdmin(role: UserRole): boolean {
  return hasRole(role, ['admin', 'sysadmin']);
}

/**
 * 사용자 관리 권한이 있는지 확인합니다.
 * (sysadmin만 가능)
 */
export function canManageUsers(role: UserRole): boolean {
  return role === 'sysadmin';
}
