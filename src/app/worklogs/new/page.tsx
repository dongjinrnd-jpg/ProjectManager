/**
 * 업무일지 작성 페이지
 *
 * Roadmap 2.12 기준
 * - 전체 페이지 형식
 * - Header + Sidebar 레이아웃
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import WorklogFormClient from './WorklogFormClient';

export default async function NewWorklogPage() {
  const session = await auth();

  if (!session) {
    redirect('/login?callbackUrl=/worklogs/new');
  }

  // engineer, admin만 작성 가능
  const userRole = session.user?.role;
  if (userRole !== 'engineer' && userRole !== 'admin') {
    redirect('/worklogs?error=permission');
  }

  return <WorklogFormClient />;
}