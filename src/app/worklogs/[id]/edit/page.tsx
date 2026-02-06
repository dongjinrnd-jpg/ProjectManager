/**
 * 업무일지 수정 페이지
 *
 * Roadmap 2.12 기준
 * - 전체 페이지 형식
 * - 본인 작성 건만 수정 가능
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import WorklogEditClient from './WorklogEditClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWorklogPage({ params }: PageProps) {
  const session = await auth();
  const { id } = await params;

  if (!session) {
    redirect(`/login?callbackUrl=/worklogs/${id}/edit`);
  }

  // engineer, admin만 수정 가능
  const userRole = session.user?.role;
  if (userRole !== 'engineer' && userRole !== 'admin') {
    redirect('/worklogs?error=permission');
  }

  return <WorklogEditClient worklogId={id} />;
}