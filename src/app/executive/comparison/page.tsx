/**
 * 계획 vs 실적 비교 페이지 (서버 컴포넌트)
 *
 * Roadmap 2.24 기준
 * - 권한: executive, admin, sysadmin만 접근 가능
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ComparisonClient from './ComparisonClient';

export default async function ComparisonPage() {
  const session = await auth();

  // 인증 체크
  if (!session) {
    redirect('/login?callbackUrl=/executive/comparison');
  }

  // 권한 체크
  const allowedRoles = ['executive', 'admin', 'sysadmin'];
  if (!allowedRoles.includes(session.user?.role || '')) {
    redirect('/dashboard');
  }

  return <ComparisonClient />;
}
