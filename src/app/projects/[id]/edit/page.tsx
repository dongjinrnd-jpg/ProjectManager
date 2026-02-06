/**
 * 프로젝트 수정 페이지
 *
 * Roadmap 2.5 기준
 * - Header + Sidebar 레이아웃
 * - 기존 프로젝트 데이터 로드 후 수정 폼 표시
 */

import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import ProjectEditClient from './ProjectEditClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProjectPage({ params }: PageProps) {
  const session = await auth();
  const { id } = await params;

  if (!session) {
    redirect(`/login?callbackUrl=/projects/${id}/edit`);
  }

  // 권한 체크: engineer, admin만 수정 가능
  const role = session.user?.role;
  if (role !== 'engineer' && role !== 'admin') {
    redirect('/projects?error=unauthorized');
  }

  return <ProjectEditClient projectId={id} />;
}