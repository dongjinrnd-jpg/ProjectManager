/**
 * 프로젝트 API Routes
 *
 * GET /api/projects - 프로젝트 목록 조회
 * POST /api/projects - 프로젝트 생성
 *
 * 권한: 로그인 필수, 생성은 engineer/admin만 가능
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  findRowByColumn,
  appendRow,
  getHeaders,
  getRows,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { Project, CreateProjectInput, ProjectStatus, ProjectStage, UserRole } from '@/types';

// 시트에서 가져온 프로젝트 타입
interface SheetProject extends Record<string, unknown> {
  id: string;
  status: ProjectStatus;
  customer: string;
  division: string;
  category: string;
  model: string;
  item: string;
  partNo: string;
  teamLeaderId: string;
  teamMembers: string;
  currentStage: ProjectStage;
  stages: string;
  progress: string;
  issues: string;
  scheduleStart: string;
  scheduleEnd: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 새 프로젝트 ID 생성
 */
async function generateProjectId(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await getRows(SHEET_NAMES.PROJECTS);

  // 올해 프로젝트 수 계산
  const prefix = `PRJ-${year}-`;
  let maxNum = 0;

  for (const row of rows) {
    if (row[0] && row[0].startsWith(prefix)) {
      const num = parseInt(row[0].replace(prefix, ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * GET /api/projects
 * 프로젝트 목록 조회
 */
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

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') as ProjectStatus | null;
    const division = searchParams.get('division') || '';
    const stage = searchParams.get('stage') as ProjectStage | null;
    const teamLeaderId = searchParams.get('teamLeaderId') || '';

    // 모든 프로젝트 조회
    const allProjects = await getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS);

    // 필터링
    let projects = allProjects.filter((project) => {
      // 검색어 필터 (고객사, ITEM)
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !project.customer.toLowerCase().includes(searchLower) &&
          !project.item.toLowerCase().includes(searchLower) &&
          !project.id.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // 상태 필터
      if (status && project.status !== status) {
        return false;
      }

      // 소속 필터
      if (division && project.division !== division) {
        return false;
      }

      // 단계 필터
      if (stage && project.currentStage !== stage) {
        return false;
      }

      // 팀장 필터
      if (teamLeaderId && project.teamLeaderId !== teamLeaderId) {
        return false;
      }

      return true;
    });

    // 최신순 정렬
    projects.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      data: projects,
      total: projects.length,
    });
  } catch (error) {
    console.error('프로젝트 목록 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * 프로젝트 생성
 */
export async function POST(request: Request) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 권한 확인 (engineer 이상, executive/sysadmin 제외)
    const role = session.user.role as UserRole;
    if (role === 'user' || role === 'executive' || role === 'sysadmin') {
      return NextResponse.json(
        { success: false, error: '프로젝트 생성 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body: CreateProjectInput = await request.json();

    // 필수 필드 검증
    if (!body.customer || !body.item || !body.teamLeaderId || !body.scheduleStart || !body.scheduleEnd) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다. (customer, item, teamLeaderId, scheduleStart, scheduleEnd)' },
        { status: 400 }
      );
    }

    // 팀장 존재 확인
    const teamLeader = await findRowByColumn(SHEET_NAMES.USERS, 'id', body.teamLeaderId);
    if (!teamLeader) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 팀장입니다.' },
        { status: 400 }
      );
    }

    // 새 ID 생성
    const projectId = await generateProjectId();

    // 현재 시간
    const now = new Date().toISOString();

    // stages 배열을 쉼표 구분 문자열로 변환
    const stagesStr = Array.isArray(body.stages) ? body.stages.join(',') : body.stages || '';
    const firstStage = stagesStr.split(',')[0] || '검토';

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.PROJECTS);

    // 새 프로젝트 데이터
    const newProject: Record<string, unknown> = {
      id: projectId,
      status: '진행중',
      customer: body.customer,
      division: body.division || '전장',
      category: body.category || '기타',
      model: body.model || '',
      item: body.item,
      partNo: body.partNo || '',
      teamLeaderId: body.teamLeaderId,
      teamMembers: body.teamMembers || '',
      currentStage: firstStage,
      stages: stagesStr,
      progress: '',
      issues: '',
      scheduleStart: body.scheduleStart,
      scheduleEnd: body.scheduleEnd,
      note: body.note || '',
      createdAt: now,
      updatedAt: now,
    };

    // 행 데이터 생성
    const rowValues = headers.map((header) => {
      const value = newProject[header];
      if (value === null || value === undefined) return '';
      return String(value);
    });

    // 시트에 추가
    await appendRow(SHEET_NAMES.PROJECTS, rowValues);

    return NextResponse.json({
      success: true,
      data: newProject as unknown as Project,
      message: '프로젝트가 생성되었습니다.',
    });
  } catch (error) {
    console.error('프로젝트 생성 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
