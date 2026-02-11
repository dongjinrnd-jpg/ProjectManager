/**
 * 고급 검색 페이지
 *
 * PRD 3.9 고급 검색/필터 기능
 * - 복합 조건 검색
 * - 키워드 검색 (범위 선택)
 * - 검색 결과 정렬
 * - 검색 조건 저장
 */

import { redirect } from 'next/navigation';
import { getSession, hasMinRole } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import SearchClient from './SearchClient';

export const metadata = {
  title: '고급 검색 | 프로젝트 관리',
};

export default async function SearchPage() {
  // 인증 확인
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }

  // 권한 확인 (engineer 이상 또는 executive)
  const userRole = session.user.role;
  if (!hasMinRole(userRole, 'engineer') && userRole !== 'executive') {
    redirect('/dashboard');
  }

  return (
    <AppLayout>
      <SearchClient />
    </AppLayout>
  );
}
