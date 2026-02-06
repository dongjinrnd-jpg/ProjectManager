/**
 * 프로젝트 목록 페이지
 *
 * 프로젝트 CRUD + 필터링/검색
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ProjectsClient from './ProjectsClient';

export default async function ProjectsPage() {
  // 인증 확인
  const session = await auth();
  if (!session) {
    redirect('/login?callbackUrl=/projects');
  }

  return <ProjectsClient />;
}
