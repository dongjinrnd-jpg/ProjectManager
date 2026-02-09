/**
 * 주간 보고 목록 페이지
 *
 * Roadmap 2.20 기준 - 주간 업무 보고 집계 화면
 * - 주차 선택 네비게이션
 * - 구분별 그룹핑 (농기, 중공업, 해외, 기타)
 * - 관리자 편집 기능 (순서 변경, 수정, 삭제)
 */

import { Metadata } from 'next';
import WeeklyReportsClient from './WeeklyReportsClient';

export const metadata: Metadata = {
  title: '주간보고 | 프로젝트 관리',
  description: '주간 업무 보고 집계 화면',
};

export default function WeeklyReportsPage() {
  return <WeeklyReportsClient />;
}