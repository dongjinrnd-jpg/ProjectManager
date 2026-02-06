/**
 * 업무일지 목록 페이지
 *
 * 업무일지 CRUD + 필터링/검색
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import WorklogsClient from './WorklogsClient';

export default async function WorklogsPage() {
  // 인증 확인
  const session = await auth();
  if (!session) {
    redirect('/login?callbackUrl=/worklogs');
  }

  return <WorklogsClient />;
}