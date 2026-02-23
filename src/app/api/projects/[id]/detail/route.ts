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
  getRows,
  getHeaders,
  rowToObject,
  SHEET_NAMES,
} from '@/lib/google';
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
  isActive: string;
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

    // 모든 데이터를 순차적으로 조회 (150ms 간격)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    await delay(150);

    // 2. 사용자 목록 조회
    const usersData = await getAllAsObjects<SheetUser>(SHEET_NAMES.USERS);
    const users: User[] = usersData
      .filter(u => u.isActive === 'TRUE')
      .map(u => ({
        ...u,
        isActive: u.isActive === 'TRUE',
        role: u.role as User['role'],
      })) as User[];

    await delay(150);

    // 3. 업무일지 조회 (해당 프로젝트)
    const worklogsData = await getAllAsObjects<SheetWorkLog>(SHEET_NAMES.WORKLOGS);
    const projectWorklogs = worklogsData.filter(w => w.projectId === projectId);

    // 최근 1주일 업무일지 (목록 표시용)
    const worklogs: WorkLog[] = projectWorklogs
      .filter(w => w.date >= oneWeekAgoStr)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(w => ({
        ...w,
        stage: w.stage as ProjectStage,
        issueStatus: (w.issueStatus || 'none') as WorkLog['issueStatus'],
      })) as WorkLog[];

    // 이슈사항 (전체 기간에서 이슈가 있는 업무일지만)
    const issues: WorkLog[] = projectWorklogs
      .filter(w => w.issue && w.issue.trim() !== '')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(w => ({
        ...w,
        stage: w.stage as ProjectStage,
        issueStatus: (w.issueStatus || 'open') as WorkLog['issueStatus'],
      })) as WorkLog[];

    await delay(150);

    // 4. 세부추진항목 조회 (해당 프로젝트)
    const schedulesData = await getAllAsObjects<SheetSchedule>(SHEET_NAMES.PROJECT_SCHEDULES);
    const schedules: ProjectSchedule[] = schedulesData
      .filter(s => s.projectId === projectId)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .map(s => ({
        ...s,
        stage: s.stage as ProjectStage,
        responsibility: (s.responsibility || '') as ProjectSchedule['responsibility'],
        category: (s.category || '') as ProjectSchedule['category'],
        status: (s.status || 'planned') as ProjectSchedule['status'],
        sortOrder: Number(s.sortOrder || 0),
      })) as ProjectSchedule[];

    await delay(150);

    // 5. 즐겨찾기 상태 조회
    const favoritesData = await getAllAsObjects<SheetFavorite>(SHEET_NAMES.FAVORITES);
    const isFavorite = favoritesData.some(
      f => f.userId === userId && f.projectId === projectId
    );

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
