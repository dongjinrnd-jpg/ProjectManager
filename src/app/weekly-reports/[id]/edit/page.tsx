/**
 * 주간 보고 수정 페이지
 */

import { Metadata } from 'next';
import WeeklyReportEditClient from './WeeklyReportEditClient';

export const metadata: Metadata = {
  title: '주간보고 수정 | 프로젝트 관리',
  description: '주간 보고 수정',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWeeklyReportPage({ params }: PageProps) {
  const { id } = await params;
  return <WeeklyReportEditClient reportId={id} />;
}