/**
 * 프로젝트 생성 페이지
 *
 * Roadmap 2.5 기준
 * - Header + Sidebar 레이아웃
 * - 섹션별 카드: 기본정보, 대표이미지, 팀구성, 대일정, 단계선택, 투자비/원가, 비고
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ProjectFormClient from './ProjectFormClient';

export default async function NewProjectPage() {
  const session = await auth();

  if (!session) {
    redirect('/login?callbackUrl=/projects/new');
  }

  // 권한 체크: engineer, admin만 생성 가능
  const role = session.user?.role;
  if (role !== 'engineer' && role !== 'admin') {
    redirect('/projects?error=unauthorized');
  }

  return <ProjectFormClient />;
}