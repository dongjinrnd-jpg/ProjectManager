/**
 * 대시보드 페이지
 *
 * Roadmap 2.3 기준
 * - 프로젝트 상태별 개수 카드
 * - 단계별 현황 차트
 * - 업무 진행사항 (1주일간 프로젝트별 최신 1개)
 * - 이슈현황
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  // 인증 확인
  const session = await auth();
  if (!session) {
    redirect('/login?callbackUrl=/dashboard');
  }

  return <DashboardClient />;
}