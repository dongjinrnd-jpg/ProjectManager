/**
 * 사용자 관리 페이지
 *
 * /admin/users
 * 권한: sysadmin만 접근 가능
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const session = await auth();

  // 로그인 체크
  if (!session?.user) {
    redirect('/login');
  }

  // 권한 체크 (sysadmin만)
  if (session.user.role !== 'sysadmin') {
    redirect('/?error=unauthorized');
  }

  return <UsersClient />;
}
