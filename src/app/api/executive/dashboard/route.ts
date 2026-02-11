/**
 * 경영진 대시보드 API
 *
 * GET /api/executive/dashboard - 경영진 대시보드 데이터 조회
 * - 즐겨찾기 프로젝트 목록 (상태 정보 포함)
 * - 상태 요약 (정상/지연/완료)
 * - 최근 회의록 목록 (1개월 이내)
 *
 * 권한: executive, admin, sysadmin
 */

import { NextResponse } from 'next/server';
import { getAllAsObjects, SHEET_NAMES } from '@/lib/google';
import { getSession } from '@/lib/auth';
import { getKoreanDate, getWeekOfMonth, getWeekRange, formatDate } from '@/lib/weekUtils';
import type { ProjectStage, ProjectStatus } from '@/types';

// 시트에서 가져온 타입들
interface SheetProject extends Record<string, unknown> {
  id: string;
  status: ProjectStatus;
  customer: string;
  item: string;
  division: string;
  category: string;
  currentStage: ProjectStage;
  stages: string;
  stageHistory: string;
  issues: string;
  teamLeaderId: string;
  scheduleStart: string;
  scheduleEnd: string;
}

interface SheetFavorite extends Record<string, unknown> {
  id: string;
  userId: string;
  projectId: string;
}

interface SheetUser extends Record<string, unknown> {
  id: string;
  name: string;
}

interface SheetComment extends Record<string, unknown> {
  id: string;
  projectId: string;
  parentId: string;
}

interface SheetWeeklyReport extends Record<string, unknown> {
  id: string;
  year: string;
  month: string;
  week: string;
  customer: string;
  item: string;
  content: string;
  isIncluded: string;
  isDeleted: string;
}

interface SheetMeetingMinutes extends Record<string, unknown> {
  id: string;
  projectId: string;
  title: string;
  hostDepartment: string;
  location: string;
  meetingDate: string;
  createdById: string;
  createdAt: string;
}

// 회의록 응답 타입
interface RecentMeetingMinutesItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  hostDepartment: string;
  location: string;
  meetingDate: string;
  createdByName: string;
}

// 경영진 대시보드용 프로젝트 타입
interface ExecutiveProject {
  id: string;
  customer: string;
  item: string;
  division: string;
  category: string;
  currentStage: ProjectStage;
  stages: string[];
  stageHistory: Record<string, string>;
  status: ProjectStatus;
  scheduleStart: string;
  scheduleEnd: string;
  teamLeaderId: string;
  teamLeaderName: string;
  issues: string;
  progress: number;
  healthStatus: 'normal' | 'delayed' | 'completed';
  commentCount: number;
}

/**
 * 프로젝트 진행률 계산 (시간 기반)
 * - 경과 일수 / 전체 일수
 */
function calculateProgress(project: SheetProject): number {
  if (project.status === '완료') return 100;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = project.scheduleStart ? new Date(project.scheduleStart) : null;
  const endDate = project.scheduleEnd ? new Date(project.scheduleEnd) : null;

  if (!startDate || !endDate) return 0;

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  if (today < startDate) return 0;
  if (today >= endDate) return 100;

  const total = endDate.getTime() - startDate.getTime();
  const elapsed = today.getTime() - startDate.getTime();

  return Math.round((elapsed / total) * 100);
}

/**
 * 프로젝트 건강 상태 판단
 * - 완료: status가 '완료'
 * - 지연: 예상 진행률보다 10% 이상 뒤처짐 또는 대일정 종료일 임박
 * - 정상: 그 외
 */
function getHealthStatus(project: SheetProject, progress: number): 'normal' | 'delayed' | 'completed' {
  if (project.status === '완료') return 'completed';
  if (project.status === '보류') return 'delayed';

  const today = new Date();
  const scheduleEnd = project.scheduleEnd ? new Date(project.scheduleEnd) : null;
  const scheduleStart = project.scheduleStart ? new Date(project.scheduleStart) : null;

  // 종료일이 지났는데 완료되지 않은 경우
  if (scheduleEnd && today > scheduleEnd) {
    return 'delayed';
  }

  // 일정 기반 예상 진행률 계산
  if (scheduleStart && scheduleEnd) {
    const totalDays = (scheduleEnd.getTime() - scheduleStart.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (today.getTime() - scheduleStart.getTime()) / (1000 * 60 * 60 * 24);
    const expectedProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

    // 진행률이 예상보다 10% 이상 뒤처지면 지연
    if (progress < expectedProgress - 10) {
      return 'delayed';
    }
  }

  return 'normal';
}

export async function GET() {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 권한 확인 (executive, admin, sysadmin만)
    const allowedRoles = ['executive', 'admin', 'sysadmin'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 데이터 조회
    const [projects, favorites, users, comments, weeklyReports, meetingMinutes] = await Promise.all([
      getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS),
      getAllAsObjects<SheetFavorite>(SHEET_NAMES.FAVORITES),
      getAllAsObjects<SheetUser>(SHEET_NAMES.USERS),
      getAllAsObjects<SheetComment>(SHEET_NAMES.COMMENTS),
      getAllAsObjects<SheetWeeklyReport>(SHEET_NAMES.WEEKLY_REPORTS),
      getAllAsObjects<SheetMeetingMinutes>(SHEET_NAMES.MEETING_MINUTES),
    ]);

    // 사용자 맵
    const userMap = new Map(users.map(u => [u.id, u.name]));

    // 현재 사용자의 즐겨찾기 프로젝트 ID 목록
    const favoriteProjectIds = favorites
      .filter(f => f.userId === session.user.id)
      .map(f => f.projectId);

    // 프로젝트별 코멘트 수 계산 (부모 코멘트만)
    const commentCountMap = new Map<string, number>();
    comments
      .filter(c => !c.parentId)
      .forEach(c => {
        const count = commentCountMap.get(c.projectId) || 0;
        commentCountMap.set(c.projectId, count + 1);
      });

    // 즐겨찾기 프로젝트 상세 정보 구성
    const favoriteProjects: ExecutiveProject[] = projects
      .filter(p => favoriteProjectIds.includes(p.id))
      .map(p => {
        const progress = calculateProgress(p);
        const healthStatus = getHealthStatus(p, progress);

        let stageHistory: Record<string, string> = {};
        if (p.stageHistory) {
          try {
            stageHistory = JSON.parse(p.stageHistory);
          } catch {
            stageHistory = {};
          }
        }

        return {
          id: p.id,
          customer: p.customer,
          item: p.item,
          division: p.division || '',
          category: p.category || '',
          currentStage: p.currentStage,
          stages: p.stages ? p.stages.split(',').map(s => s.trim()) : [],
          stageHistory,
          status: p.status,
          scheduleStart: p.scheduleStart || '',
          scheduleEnd: p.scheduleEnd || '',
          teamLeaderId: p.teamLeaderId,
          teamLeaderName: userMap.get(p.teamLeaderId) || p.teamLeaderId,
          issues: p.issues || '',
          progress,
          healthStatus,
          commentCount: commentCountMap.get(p.id) || 0,
        };
      });

    // 상태 요약
    const statusSummary = {
      normal: favoriteProjects.filter(p => p.healthStatus === 'normal').length,
      delayed: favoriteProjects.filter(p => p.healthStatus === 'delayed').length,
      completed: favoriteProjects.filter(p => p.healthStatus === 'completed').length,
    };

    // 현재 주차 정보
    const koreanDate = getKoreanDate();
    const year = koreanDate.getFullYear();
    const month = koreanDate.getMonth() + 1;
    const week = getWeekOfMonth(koreanDate);
    const { start: weekStart, end: weekEnd } = getWeekRange(year, month, week);

    // 최근 1개월 이내 회의록
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // 프로젝트 맵 (id -> customer + item)
    const projectMap = new Map(projects.map(p => [p.id, `${p.customer} ${p.item}`]));

    const recentMeetingMinutes: RecentMeetingMinutesItem[] = meetingMinutes
      .filter(m => {
        // 즐겨찾기 프로젝트만
        if (!favoriteProjectIds.includes(m.projectId)) return false;
        // 회의일 기준 1개월 이내
        const meetingDateObj = new Date(m.meetingDate?.split(' ')[0] || '');
        return meetingDateObj >= oneMonthAgo;
      })
      .map(m => ({
        id: m.id,
        projectId: m.projectId,
        projectName: projectMap.get(m.projectId) || m.projectId,
        title: m.title,
        hostDepartment: m.hostDepartment || '',
        location: m.location || '',
        meetingDate: m.meetingDate,
        createdByName: userMap.get(m.createdById) || m.createdById,
      }))
      // 회의일 기준 최신순
      .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        favoriteProjects,
        statusSummary,
        recentMeetingMinutes,
        currentWeek: {
          year,
          month,
          week,
          weekStart: formatDate(weekStart),
          weekEnd: formatDate(weekEnd),
        },
      },
    });
  } catch (error) {
    console.error('경영진 대시보드 데이터 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
