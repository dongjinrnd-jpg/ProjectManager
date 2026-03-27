/**
 * 대시보드 API
 *
 * GET /api/dashboard - 대시보드 데이터 조회
 * - 프로젝트 상태별 개수
 * - 단계별 현황
 * - 업무 진행사항 (1주일간 프로젝트별 최신 1개)
 * - 이슈현황 (이슈사항이 있는 프로젝트)
 */

import { NextResponse } from 'next/server';
import { getAllAsObjects, query, SHEET_NAMES } from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { ProjectStage, ProjectStatus } from '@/types';

// 시트에서 가져온 타입
interface SheetProject extends Record<string, unknown> {
  id: string;
  status: ProjectStatus;
  customer: string;
  item: string;
  currentStage: ProjectStage;
  issues: string;
  teamLeaderId: string;
}

interface SheetWorkLog extends Record<string, unknown> {
  id: string;
  projectId: string;
  date: string;
  customer: string;
  item: string;
  stage: string;
  assigneeId: string;
  content: string;
  createdAt: string;
}

interface SheetFavorite extends Record<string, unknown> {
  id: string;
  userId: string;
  projectId: string;
  createdAt: string;
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

    // 1주일 전 날짜 계산
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    // 병렬 조회: 프로젝트, 최근 업무일지, 사용자 즐겨찾기
    const [projects, recentWorklogsFiltered, userFavorites] = await Promise.all([
      getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS),
      query<SheetWorkLog>(SHEET_NAMES.WORKLOGS, {
        filters: [{ column: 'date', op: 'gte', value: oneWeekAgoStr }],
        orderBy: { column: 'date', ascending: false },
      }),
      query<SheetFavorite>(SHEET_NAMES.FAVORITES, {
        filters: [{ column: 'userId', op: 'eq', value: session.user.id }],
      }),
    ]);

    const favoriteProjectIds = userFavorites.map(f => f.projectId);

    // 즐겨찾기 프로젝트 필터링
    const favoriteProjects = projects.filter(p => favoriteProjectIds.includes(p.id));

    // 1. 상태별 프로젝트 개수
    const statusCounts = {
      total: projects.length,
      active: projects.filter(p => p.status === '진행중').length,
      hold: projects.filter(p => p.status === '보류').length,
      favorites: userFavorites.length,
    };

    // 즐겨찾기 프로젝트 상태별 개수
    const favoriteStatusCounts = {
      total: favoriteProjects.length,
      active: favoriteProjects.filter(p => p.status === '진행중').length,
      hold: favoriteProjects.filter(p => p.status === '보류').length,
      favorites: favoriteProjects.length,
    };

    // 2. 단계별 현황 (진행중인 프로젝트만)
    const activeProjects = projects.filter(p => p.status === '진행중');
    const activeFavoriteProjects = favoriteProjects.filter(p => p.status === '진행중');
    const stageCounts: Record<string, number> = {};
    const favoriteStageCounts: Record<string, number> = {};
    const stages: ProjectStage[] = [
      '검토', '설계', '개발', 'PROTO', '신뢰성', 'P1', 'P2',
      '승인', '양산이관', '초도양산', '품질관리', '원가절감', '품질개선', '설계변경'
    ];

    stages.forEach(stage => {
      stageCounts[stage] = activeProjects.filter(p => p.currentStage === stage).length;
      favoriteStageCounts[stage] = activeFavoriteProjects.filter(p => p.currentStage === stage).length;
    });

    // 프로젝트별 최신 1개만 추출
    const projectWorklogMap = new Map<string, SheetWorkLog>();
    for (const worklog of recentWorklogsFiltered) {
      if (!projectWorklogMap.has(worklog.projectId)) {
        projectWorklogMap.set(worklog.projectId, worklog);
      }
    }

    // 최대 10개 프로젝트까지 표시
    const recentWorklogs = Array.from(projectWorklogMap.values())
      .slice(0, 10)
      .map(w => ({
        id: w.id,
        projectId: w.projectId,
        date: w.date,
        customer: w.customer,
        item: w.item,
        stage: w.stage,
        assigneeId: w.assigneeId,
      }));

    // 4. 이슈사항 현황 (issues가 있는 프로젝트)
    const issueProjects = activeProjects
      .filter(p => p.issues && p.issues.trim() !== '')
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        customer: p.customer,
        item: p.item,
        issues: p.issues,
      }));

    return NextResponse.json({
      success: true,
      data: {
        statusCounts,
        favoriteStatusCounts,
        stageCounts,
        favoriteStageCounts,
        recentWorklogs,
        issueProjects,
        favoriteProjectIds,
      },
    });
  } catch (error) {
    console.error('대시보드 데이터 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}