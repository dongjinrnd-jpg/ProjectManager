/**
 * 개선요청 등록 페이지
 *
 * 새로운 버그/개선요청/기능추가 요청을 등록
 * 권한: engineer, admin, sysadmin
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ImprovementFormClient from '../ImprovementFormClient';

export default async function NewImprovementPage() {
  // 인증 확인
  const session = await auth();
  if (!session) {
    redirect('/login?callbackUrl=/improvements/new');
  }

  // 권한 확인
  const allowedRoles = ['engineer', 'admin', 'sysadmin'];
  if (!allowedRoles.includes(session.user.role)) {
    redirect('/dashboard');
  }

  return <ImprovementFormClient />;
}
