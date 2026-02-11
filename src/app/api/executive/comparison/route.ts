/**
 * 계획 vs 실적 비교 API
 *
 * GET /api/executive/comparison - 계획 vs 실적 데이터 조회
 * - 즐겨찾기 프로젝트의 월별 계획/실적 비교
 *
 * 권한: executive, admin, sysadmin
 */

import { NextResponse } from 'next/server';
import { getAllAsObjects, SHEET_NAMES } from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { ProjectStatus } from '@/types';

// 시트 타입
interface SheetProject extends Record<string, unknown> {
  id: string;
  status: ProjectStatus;
  customer: string;
  item: string;
  currentStage: string;
  stages: string;
  stageHistory: string;
  scheduleStart: string;
  scheduleEnd: string;
  teamLeaderId: string;
}

interface SheetFavorite extends Record<string, unknown> {
  userId: string;
  projectId: string;
}

interface SheetSchedule extends Record<string, unknown> {
  id: string;
  projectId: string;
  taskName: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  status: string;
}

interface SheetUser extends Record<string, unknown> {
  id: string;
  name: string;
}

// 월별 데이터 타입
interface MonthlyData {
  month: number;
  hasPlan: boolean;
  hasActual: boolean;
  planProgress: number; // 0-100
  actualProgress: number; // 0-100
}

// 비교 프로젝트 타입
interface ComparisonProject {
  id: string;
  customer: string;
  item: string;
  currentStage: string;
  status: ProjectStatus;
  scheduleStart: string;
  scheduleEnd: string;
  teamLeaderName: string;
  healthStatus: 'normal' | 'delayed' | 'completed';
  progress: number;
  monthlyData: MonthlyData[];
}

/**
 * 프로젝트 진행률 계산
 */
function calculateProgress(project: SheetProject): number {
  if (project.status === '완료') return 100;

  const stages = project.stages ? project.stages.split(',').map(s => s.trim()) : [];
  if (stages.length === 0) return 0;

  const currentStageIndex = stages.indexOf(project.currentStage);
  if (currentStageIndex < 0) return 0;

  return Math.round((currentStageIndex / stages.length) * 100);
}

/**
 * 프로젝트 건강 상태 판단
 * - 완료: status가 '완료'
 * - 지연: 예상 진행률보다 10% 이상 뒤처짐 또는 대일정 종료일 지남
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

/**
 * 월별 진행 데이터 계산
 */
function calculateMonthlyData(
  project: SheetProject,
  schedules: SheetSchedule[],
  year: number
): MonthlyData[] {
  const monthlyData: MonthlyData[] = [];
  const projectSchedules = schedules.filter(s => s.projectId === project.id);

  for (let month = 1; month <= 12; month++) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    // 프로젝트 대일정 기준
    const projStart = project.scheduleStart ? new Date(project.scheduleStart) : null;
    const projEnd = project.scheduleEnd ? new Date(project.scheduleEnd) : null;

    let hasPlan = false;
    let hasActual = false;
    let planProgress = 100; // 해당 월에 계획이 있으면 100%로 표시
    let actualProgress = 0;

    // 대일정 기준 계획 여부 (프로젝트 대일정 또는 세부추진항목 계획)
    if (projStart && projEnd) {
      // 이 월과 대일정이 겹치는지 확인
      if (projStart <= monthEnd && projEnd >= monthStart) {
        hasPlan = true;
      }
    }

    // 세부추진항목 계획 기준 (대일정이 없어도 세부추진항목 계획이 있으면 표시)
    for (const schedule of projectSchedules) {
      if (schedule.plannedStart && schedule.plannedEnd) {
        const plannedStart = new Date(schedule.plannedStart);
        const plannedEnd = new Date(schedule.plannedEnd);

        if (plannedStart <= monthEnd && plannedEnd >= monthStart) {
          hasPlan = true;
          break;
        }
      }
    }

    // 세부추진항목 기준 실적 여부 및 진행률 계산
    let actualItemsInMonth = 0;
    let totalItemsInMonth = 0;

    for (const schedule of projectSchedules) {
      // 이 월과 겹치는 계획 항목 체크
      const hasPlannedInMonth = schedule.plannedStart && schedule.plannedEnd &&
        new Date(schedule.plannedStart) <= monthEnd &&
        new Date(schedule.plannedEnd) >= monthStart;

      // 이 월과 겹치는 실적 항목 체크
      if (schedule.actualStart) {
        const actualStart = new Date(schedule.actualStart);
        const actualEnd = schedule.actualEnd ? new Date(schedule.actualEnd) : new Date();

        if (actualStart <= monthEnd && actualEnd >= monthStart) {
          hasActual = true;
          actualItemsInMonth++;
        }
      }

      if (hasPlannedInMonth) {
        totalItemsInMonth++;
      }
    }

    // 실적 진행률: 해당 월에 실적이 있는 항목 비율
    if (hasActual) {
      // 실적이 있으면 100% 표시 (해당 월에 작업이 진행되었음을 의미)
      actualProgress = 100;
    }

    monthlyData.push({
      month,
      hasPlan,
      hasActual,
      planProgress,
      actualProgress,
    });
  }

  return monthlyData;
}

export async function GET(request: Request) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 권한 확인
    const allowedRoles = ['executive', 'admin', 'sysadmin'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const favoritesOnly = searchParams.get('favoritesOnly') !== 'false';

    // 데이터 조회
    const [projects, favorites, schedules, users] = await Promise.all([
      getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS),
      getAllAsObjects<SheetFavorite>(SHEET_NAMES.FAVORITES),
      getAllAsObjects<SheetSchedule>(SHEET_NAMES.PROJECT_SCHEDULES),
      getAllAsObjects<SheetUser>(SHEET_NAMES.USERS),
    ]);

    // 사용자 맵
    const userMap = new Map(users.map(u => [u.id, u.name]));

    // 즐겨찾기 프로젝트 ID
    const favoriteProjectIds = favorites
      .filter(f => f.userId === session.user.id)
      .map(f => f.projectId);

    // 프로젝트 필터링
    let filteredProjects = projects;
    if (favoritesOnly) {
      filteredProjects = projects.filter(p => favoriteProjectIds.includes(p.id));
    }

    // 비교 데이터 구성
    const comparisonProjects: ComparisonProject[] = filteredProjects.map(p => {
      const progress = calculateProgress(p);
      const healthStatus = getHealthStatus(p, progress);
      const monthlyData = calculateMonthlyData(p, schedules, year);

      return {
        id: p.id,
        customer: p.customer,
        item: p.item,
        currentStage: p.currentStage,
        status: p.status,
        scheduleStart: p.scheduleStart || '',
        scheduleEnd: p.scheduleEnd || '',
        teamLeaderName: userMap.get(p.teamLeaderId) || p.teamLeaderId,
        healthStatus,
        progress,
        monthlyData,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        projects: comparisonProjects,
        year,
        favoritesOnly,
      },
    });
  } catch (error) {
    console.error('계획vs실적 비교 데이터 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
