/**
 * 개선요청 목록 페이지
 *
 * 버그, 개선요청, 기능추가 요청을 관리하는 게시판
 * 권한: engineer, admin, sysadmin만 접근 가능
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ImprovementsClient from './ImprovementsClient';

export default async function ImprovementsPage() {
  // 인증 확인
  const session = await auth();
  if (!session) {
    redirect('/login?callbackUrl=/improvements');
  }

  // 권한 확인 (engineer, admin, sysadmin만 접근 가능)
  const allowedRoles = ['engineer', 'admin', 'sysadmin'];
  if (!allowedRoles.includes(session.user.role)) {
    redirect('/dashboard');
  }

  return <ImprovementsClient />;
}
