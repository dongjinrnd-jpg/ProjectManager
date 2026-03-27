/**
 * 프로젝트 상세 통합 API
 *
 * GET /api/projects/[id]/detail
 *
 * 한 번의 API 호출로 프로젝트 상세에 필요한 모든 데이터를 반환
 * - 프로젝트 정보
 * - 사용자 목록
 * - 업무일지 (최근 1주일)
 * - 세부추진항목
 * - 즐겨찾기 상태
 *
 * API 할당량 절약: 5회 호출 → 1회 호출
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  findRowByColumn,
  query,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { Project, User, WorkLog, ProjectSchedule, ProjectStage } from '@/types';

// 시트 타입 정의
interface SheetProject extends Record<string, unknown> {
  id: string;
  item: string;
  customer: string;
  partNo: string;
  division: string;
  category: string;
  status: string;
  currentStage: ProjectStage;
  stages: string;
  teamLeaderId: string;
  teamMembers: string;
  scheduleStart: string;
  scheduleEnd: string;
  progress: string;
  issues: string;
  createdAt: string;
  updatedAt: string;
}

interface SheetUser extends Record<string, unknown> {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean | string;
}

interface SheetWorkLog extends Record<string, unknown> {
  id: string;
  date: string;
  projectId: string;
  item: string;
  customer: string;
  stage: ProjectStage;
  assigneeId: string;
  participants: string;
  plan: string;
  content: string;
  issue: string;
  issueStatus: string;
  issueResolvedAt: string;
  scheduleId: string;
  createdAt: string;
  updatedAt: string;
}

interface SheetSchedule extends Record<string, unknown> {
  id: string;
  projectId: string;
  stage: string;
  taskName: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  responsibility: string;
  category: string;
  status: string;
  note: string;
  sortOrder: string;
  createdAt: string;
  updatedAt: string;
}

interface SheetFavorite extends Record<string, unknown> {
  id: string;
  userId: string;
  projectId: string;
  createdAt: string;
}

/**
 * GET /api/projects/[id]/detail
 * 프로젝트 상세 통합 조회
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const userId = session.user.id;

    // 1주일 전 날짜 계산
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    // 1. 프로젝트 조회
    const projectResult = await findRowByColumn<SheetProject>(
      SHEET_NAMES.PROJECTS,
      'id',
      projectId
    );

    if (!projectResult) {
      return NextResponse.json(
        { success: false, error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const project: Project = {
      ...projectResult.data,
      status: projectResult.data.status as Project['status'],
      currentStage: projectResult.data.currentStage as ProjectStage,
    } as Project;

    // 2~5. 나머지 데이터 병렬 조회 (서버사이드 필터링)
    const [usersData, recentWorklogs, allProjectWorklogs, schedulesData, favoriteResults] = await Promise.all([
      // 사용자 목록
      getAllAsObjects<SheetUser>(SHEET_NAMES.USERS),
      // 최근 1주일 업무일지 (해당 프로젝트)
      query<SheetWorkLog>(SHEET_NAMES.WORKLOGS, {
        filters: [
          { column: 'projectId', op: 'eq', value: projectId },
          { column: 'date', op: 'gte', value: oneWeekAgoStr },
        ],
        orderBy: { column: 'date', ascending: false },
      }),
      // 이슈용 전체 업무일지 (해당 프로젝트, issue가 있는 것만은 JS에서 필터)
      query<SheetWorkLog>(SHEET_NAMES.WORKLOGS, {
        filters: [{ column: 'projectId', op: 'eq', value: projectId }],
        orderBy: { column: 'date', ascending: false },
      }),
      // 세부추진항목 (해당 프로젝트)
      query<SheetSchedule>(SHEET_NAMES.PROJECT_SCHEDULES, {
        filters: [{ column: 'projectId', op: 'eq', value: projectId }],
      }),
      // 즐겨찾기 상태
      query<SheetFavorite>(SHEET_NAMES.FAVORITES, {
        filters: [
          { column: 'userId', op: 'eq', value: userId },
          { column: 'projectId', op: 'eq', value: projectId },
        ],
        limit: 1,
      }),
    ]);

    // 사용자 목록 변환
    const users: User[] = usersData
      .filter(u => u.isActive === true || u.isActive === 'TRUE')
      .map(u => ({
        ...u,
        isActive: u.isActive === true || u.isActive === 'TRUE',
        role: u.role as User['role'],
      })) as User[];

    // 최근 1주일 업무일지
    const worklogs: WorkLog[] = recentWorklogs.map(w => ({
      ...w,
      stage: w.stage as ProjectStage,
      issueStatus: (w.issueStatus || 'none') as WorkLog['issueStatus'],
    })) as WorkLog[];

    // 이슈사항 (전체 기간에서 이슈가 있는 업무일지만)
    const issues: WorkLog[] = allProjectWorklogs
      .filter(w => w.issue && w.issue.trim() !== '')
      .map(w => ({
        ...w,
        stage: w.stage as ProjectStage,
        issueStatus: (w.issueStatus || 'open') as WorkLog['issueStatus'],
      })) as WorkLog[];

    // 세부추진항목 정렬 및 변환
    const stageOrder = projectResult.data.stages
      ? projectResult.data.stages.split(',').map((s: string) => s.trim())
      : [];
    const schedules: ProjectSchedule[] = schedulesData
      .sort((a, b) => {
        const idxA = stageOrder.indexOf(a.stage || '');
        const idxB = stageOrder.indexOf(b.stage || '');
        const safeA = idxA === -1 ? stageOrder.length : idxA;
        const safeB = idxB === -1 ? stageOrder.length : idxB;
        if (safeA !== safeB) return safeA - safeB;
        const dateCompare = (a.plannedStart || '').localeCompare(b.plannedStart || '');
        if (dateCompare !== 0) return dateCompare;
        return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      })
      .map(s => ({
        id: s.id,
        projectId: s.projectId,
        stage: s.stage as ProjectStage,
        taskName: s.taskName,
        category: (s.category || undefined) as ProjectSchedule['category'],
        responsibility: (s.responsibility || undefined) as ProjectSchedule['responsibility'],
        plannedStart: s.plannedStart,
        plannedEnd: s.plannedEnd,
        actualStart: s.actualStart || undefined,
        actualEnd: s.actualEnd || undefined,
        status: (s.status || 'planned') as ProjectSchedule['status'],
        note: s.note || undefined,
        order: Number(s.sortOrder || 0),
      })) as ProjectSchedule[];

    // 즐겨찾기 상태
    const isFavorite = favoriteResults.length > 0;

    return NextResponse.json({
      success: true,
      data: {
        project,
        users,
        worklogs,
        issues,  // 이슈사항 추가
        schedules,
        isFavorite,
      },
    });
  } catch (error) {
    console.error('프로젝트 상세 통합 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
