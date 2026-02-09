'use client';

/**
 * 주간 보고 수정 클라이언트 컴포넌트
 * 등록 폼을 재사용
 */

import WeeklyReportFormClient from '../../new/WeeklyReportFormClient';

interface WeeklyReportEditClientProps {
  reportId: string;
}

export default function WeeklyReportEditClient({
  reportId,
}: WeeklyReportEditClientProps) {
  return <WeeklyReportFormClient editMode={true} reportId={reportId} />;
}