/**
 * 프로젝트 상세 페이지
 *
 * Roadmap 2.6 / PRD 3.1.2 기준
 * - Header + Sidebar 레이아웃
 * - 프로젝트 기본 정보 표시
 * - 상태 변경, 삭제 기능
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ProjectDetailClient from './ProjectDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const session = await auth();
  const { id } = await params;

  if (!session) {
    redirect(`/login?callbackUrl=/projects/${id}`);
  }

  return <ProjectDetailClient projectId={id} />;
}
