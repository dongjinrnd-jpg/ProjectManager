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
import { getAllAsObjects, SHEET_NAMES } from '@/lib/google';
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

    // 프로젝트 목록 조회
    const projects = await getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS);

    // 업무일지 목록 조회
    const worklogs = await getAllAsObjects<SheetWorkLog>(SHEET_NAMES.WORKLOGS);

    // 즐겨찾기 목록 조회 (현재 사용자)
    const allFavorites = await getAllAsObjects<SheetFavorite>(SHEET_NAMES.FAVORITES);
    const userFavorites = allFavorites.filter(f => f.userId === session.user.id);
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

    // 3. 업무 진행사항 (1주일간 프로젝트별 최신 1개)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // 1주일 이내 업무일지 필터링 후 날짜순 정렬
    const recentWorklogsFiltered = [...worklogs]
      .filter(w => new Date(w.date) >= oneWeekAgo)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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