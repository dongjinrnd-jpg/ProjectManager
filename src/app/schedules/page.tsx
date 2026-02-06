/**
 * 전체 일정 페이지
 * /schedules
 *
 * Roadmap 2.13 기준:
 * - 전체 프로젝트의 대일정을 간트차트로 표시
 * - 필터: 즐겨찾기, 상태, 소속, 구분
 * - Excel 다운로드 (Phase 3)
 */

import SchedulesClient from './SchedulesClient';

export const metadata = {
  title: '전체 일정 | Project Manager',
  description: '전체 프로젝트 일정 간트차트',
};

export default function SchedulesPage() {
  return <SchedulesClient />;
}