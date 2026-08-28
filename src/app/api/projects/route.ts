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
  findRowByColumn,
  insertRow,
  query,
  SHEET_NAMES,
  generateSequentialId,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { Project, CreateProjectInput, ProjectStatus, ProjectStage, UserRole } from '@/types';

/**
 * 새 프로젝트 ID 생성
 */
async function generateProjectId(): Promise<string> {
  const year = new Date().getFullYear();
  return generateSequentialId(SHEET_NAMES.PROJECTS, `PRJ-${year}-`, 3);
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
    const ids = searchParams.get('ids') || ''; // 즐겨찾기 등 특정 ID 목록

    // 서버사이드 필터링으로 조회
    const filters: Array<{ column: string; op: 'eq' | 'ilike' | 'in'; value: unknown }> = [];
    if (ids) {
      const idList = ids.split(',').filter(Boolean);
      if (idList.length === 0) {
        // 빈 ID 목록이면 빈 결과 반환
        return NextResponse.json({ success: true, data: [], total: 0 });
      }
      filters.push({ column: 'id', op: 'in', value: idList });
    }
    if (status) filters.push({ column: 'status', op: 'eq', value: status });
    if (division) filters.push({ column: 'division', op: 'eq', value: division });
    if (stage) filters.push({ column: 'currentStage', op: 'eq', value: stage });
    if (teamLeaderId) filters.push({ column: 'teamLeaderId', op: 'eq', value: teamLeaderId });

    // 검색어: OR 조건 (customer, item, id)
    const orFilter = search
      ? `customer.ilike.%${search}%,item.ilike.%${search}%,id.ilike.%${search}%`
      : undefined;

    const projects = await query<Record<string, unknown>>(SHEET_NAMES.PROJECTS, {
      filters,
      or: orFilter,
      orderBy: { column: 'createdAt', ascending: false },
    });

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

    // 시트에 추가
    await insertRow(SHEET_NAMES.PROJECTS, newProject);

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
