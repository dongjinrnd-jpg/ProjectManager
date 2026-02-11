/**
 * 경영진 대시보드 페이지 (서버 컴포넌트)
 *
 * Roadmap 2.23 기준
 * - 권한: executive, admin, sysadmin만 접근 가능
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ExecutiveClient from './ExecutiveClient';

export default async function ExecutivePage() {
  const session = await auth();

  // 인증 체크
  if (!session) {
    redirect('/login?callbackUrl=/executive');
  }

  // 권한 체크
  const allowedRoles = ['executive', 'admin', 'sysadmin'];
  if (!allowedRoles.includes(session.user?.role || '')) {
    redirect('/dashboard');
  }

  return <ExecutiveClient />;
}
