/**
 * 주간 보고 등록 페이지
 *
 * Roadmap 2.21 기준
 */

import { Metadata } from 'next';
import WeeklyReportFormClient from './WeeklyReportFormClient';

export const metadata: Metadata = {
  title: '주간보고 등록 | 프로젝트 관리',
  description: '주간 보고 등록',
};

export default function NewWeeklyReportPage() {
  return <WeeklyReportFormClient />;
}