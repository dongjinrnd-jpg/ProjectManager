/**
 * 시스템 설정 페이지
 *
 * /admin/settings
 * 권한: sysadmin만 접근 가능
 *
 * PRD 3.11 시스템 설정:
 * - 개발 단계 관리
 * - 시스템 옵션
 * - 데이터 관리
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const session = await auth();

  // 로그인 체크
  if (!session?.user) {
    redirect('/login');
  }

  // 권한 체크 (sysadmin만)
  if (session.user.role !== 'sysadmin') {
    redirect('/?error=unauthorized');
  }

  return <SettingsClient />;
}
