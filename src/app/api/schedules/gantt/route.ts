/**
 * 전체 프로젝트 간트차트 API
 *
 * GET /api/schedules/gantt - 전체 프로젝트 일정 조회
 * - 프로젝트의 대일정 (scheduleStart ~ scheduleEnd) 표시
 * - 월별 타임라인 형태로 표시
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllAsObjects, SHEET_NAMES } from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { ProjectStatus, ProjectStage } from '@/types';

// 시트에서 가져온 타입
interface SheetProject extends Record<string, unknown> {
  id: string;
  status: ProjectStatus;
  customer: string;
  division: string;
  category: string;
  item: string;
  currentStage: ProjectStage;
  teamLeaderId: string;
  scheduleStart: string;
  scheduleEnd: string;
}

interface SheetFavorite extends Record<string, unknown> {
  id: string;
  userId: string;
  projectId: string;
  createdAt: string;
}

// 간트차트용 프로젝트 데이터
export interface GanttProject {
  id: string;
  customer: string;
  item: string;
  division: string;
  category: string;
  status: ProjectStatus;
  currentStage: ProjectStage;
  scheduleStart: string;
  scheduleEnd: string;
  isFavorite: boolean;
  teamLeaderId: string;
}

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams;
    const favoritesOnly = searchParams.get('favorites') === 'true';
    const statusFilter = searchParams.get('status') as ProjectStatus | null;
    const divisionFilter = searchParams.get('division');
    const categoryFilter = searchParams.get('category');

    // 프로젝트 목록 조회
    const projects = await getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS);

    // 즐겨찾기 목록 조회
    const allFavorites = await getAllAsObjects<SheetFavorite>(SHEET_NAMES.FAVORITES);
    const userFavorites = allFavorites.filter(f => f.userId === session.user.id);
    const favoriteProjectIds = new Set(userFavorites.map(f => f.projectId));

    // 필터링
    let filteredProjects = projects;

    // 즐겨찾기 필터
    if (favoritesOnly) {
      filteredProjects = filteredProjects.filter(p => favoriteProjectIds.has(p.id));
    }

    // 상태 필터
    if (statusFilter) {
      filteredProjects = filteredProjects.filter(p => p.status === statusFilter);
    }

    // 소속 필터
    if (divisionFilter) {
      filteredProjects = filteredProjects.filter(p => p.division === divisionFilter);
    }

    // 구분 필터
    if (categoryFilter) {
      filteredProjects = filteredProjects.filter(p => p.category === categoryFilter);
    }

    // 일정이 있는 프로젝트만 (scheduleStart, scheduleEnd 필수)
    filteredProjects = filteredProjects.filter(
      p => p.scheduleStart && p.scheduleEnd
    );

    // 시작일 기준 정렬
    filteredProjects.sort((a, b) => {
      const dateA = new Date(a.scheduleStart);
      const dateB = new Date(b.scheduleStart);
      return dateA.getTime() - dateB.getTime();
    });

    // 간트차트용 데이터 변환
    const ganttProjects: GanttProject[] = filteredProjects.map(p => ({
      id: p.id,
      customer: p.customer,
      item: p.item,
      division: p.division || '',
      category: p.category || '',
      status: p.status,
      currentStage: p.currentStage,
      scheduleStart: p.scheduleStart,
      scheduleEnd: p.scheduleEnd,
      isFavorite: favoriteProjectIds.has(p.id),
      teamLeaderId: p.teamLeaderId,
    }));

    // 날짜 범위 계산 (전체 프로젝트 기준)
    let minDate: string | null = null;
    let maxDate: string | null = null;

    ganttProjects.forEach(p => {
      if (!minDate || p.scheduleStart < minDate) {
        minDate = p.scheduleStart;
      }
      if (!maxDate || p.scheduleEnd > maxDate) {
        maxDate = p.scheduleEnd;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        projects: ganttProjects,
        dateRange: {
          start: minDate,
          end: maxDate,
        },
        totalCount: ganttProjects.length,
      },
    });
  } catch (error) {
    console.error('전체 간트차트 데이터 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}