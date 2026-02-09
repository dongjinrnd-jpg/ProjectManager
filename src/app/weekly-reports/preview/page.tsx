/**
 * 주간 보고서 미리보기 페이지
 *
 * - 제출용(isIncluded=true)인 항목만 표시
 * - 관리자 전용 (admin)
 * - PDF 다운로드 기능
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import WeeklyReportPreviewClient from './WeeklyReportPreviewClient';

export default async function WeeklyReportPreviewPage() {
  const session = await auth();

  if (!session) {
    redirect('/login?callbackUrl=/weekly-reports/preview');
  }

  // admin만 접근 가능
  if (session.user?.role !== 'admin') {
    redirect('/weekly-reports');
  }

  return <WeeklyReportPreviewClient />;
}