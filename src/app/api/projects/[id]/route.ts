/**
 * 프로젝트 상세 API Routes
 *
 * GET /api/projects/[id] - 프로젝트 상세 조회
 * PUT /api/projects/[id] - 프로젝트 수정
 * DELETE /api/projects/[id] - 프로젝트 삭제
 *
 * 권한: 로그인 필수, 수정/삭제는 담당자 또는 admin 이상
 */

import { NextResponse } from 'next/server';
import {
  findRowByColumn,
  updateRow,
  deleteRow,
  getHeaders,
  objectToRow,
  appendRow,
  getRows,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession, hasMinRole, isAdmin } from '@/lib/auth';
import type { Project, UpdateProjectInput, ProjectStatus, ProjectStage, UserRole } from '@/types';

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
 * 프로젝트 이력 기록
 */
async function recordHistory(
  projectId: string,
  changedField: string,
  oldValue: string,
  newValue: string,
  changedById: string
): Promise<void> {
  const headers = await getHeaders(SHEET_NAMES.PROJECT_HISTORY);
  const rows = await getRows(SHEET_NAMES.PROJECT_HISTORY);

  // 새 ID 생성
  const maxNum = rows.reduce((max, row) => {
    if (row[0] && row[0].startsWith('PH-')) {
      const num = parseInt(row[0].replace('PH-', ''), 10);
      return num > max ? num : max;
    }
    return max;
  }, 0);
  const historyId = `PH-${String(maxNum + 1).padStart(3, '0')}`;

  const now = new Date().toISOString();
  const historyData: Record<string, unknown> = {
    id: historyId,
    projectId,
    changedField,
    oldValue,
    newValue,
    changedById,
    changedAt: now,
  };

  const rowValues = headers.map((header) => {
    const value = historyData[header];
    if (value === null || value === undefined) return '';
    return String(value);
  });

  await appendRow(SHEET_NAMES.PROJECT_HISTORY, rowValues);
}

/**
 * GET /api/projects/[id]
 * 프로젝트 상세 조회
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 프로젝트 찾기
    const result = await findRowByColumn<SheetProject>(
      SHEET_NAMES.PROJECTS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('프로젝트 조회 오류:', error);
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
 * PUT /api/projects/[id]
 * 프로젝트 수정
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 프로젝트 찾기
    const result = await findRowByColumn<SheetProject>(
      SHEET_NAMES.PROJECTS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { rowIndex, data: existingProject } = result;

    // 권한 확인 (팀장, 팀원, 또는 admin 이상)
    const userRole = session.user.role as UserRole;
    const isTeamMember =
      existingProject.teamLeaderId === session.user.id ||
      existingProject.teamMembers.split(',').includes(session.user.id);

    if (!isTeamMember && !isAdmin(userRole)) {
      return NextResponse.json(
        { success: false, error: '프로젝트 수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body: UpdateProjectInput = await request.json();

    // 현재 시간
    const now = new Date().toISOString();

    // 변경 이력 기록 (주요 필드만)
    const trackFields = ['status', 'currentStage', 'teamLeaderId'];
    for (const field of trackFields) {
      if (body[field as keyof UpdateProjectInput] !== undefined) {
        const oldVal = String(existingProject[field] || '');
        const newVal = String(body[field as keyof UpdateProjectInput] || '');
        if (oldVal !== newVal) {
          await recordHistory(id, field, oldVal, newVal, session.user.id);
        }
      }
    }

    // 업데이트할 데이터 병합
    const updatedProject: Record<string, unknown> = {
      ...existingProject,
      status: body.status ?? existingProject.status,
      customer: body.customer ?? existingProject.customer,
      division: body.division ?? existingProject.division,
      category: body.category ?? existingProject.category,
      model: body.model ?? existingProject.model,
      item: body.item ?? existingProject.item,
      partNo: body.partNo ?? existingProject.partNo,
      teamLeaderId: body.teamLeaderId ?? existingProject.teamLeaderId,
      teamMembers: body.teamMembers ?? existingProject.teamMembers,
      currentStage: body.currentStage ?? existingProject.currentStage,
      stages: body.stages ?? existingProject.stages,
      progress: body.progress ?? existingProject.progress,
      issues: body.issues ?? existingProject.issues,
      scheduleStart: body.scheduleStart ?? existingProject.scheduleStart,
      scheduleEnd: body.scheduleEnd ?? existingProject.scheduleEnd,
      note: body.note ?? existingProject.note,
      updatedAt: now,
    };

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.PROJECTS);

    // 행 데이터 생성
    const rowValues = objectToRow(headers, updatedProject);

    // 시트 업데이트
    await updateRow(SHEET_NAMES.PROJECTS, rowIndex, rowValues);

    return NextResponse.json({
      success: true,
      data: updatedProject as unknown as Project,
      message: '프로젝트가 수정되었습니다.',
    });
  } catch (error) {
    console.error('프로젝트 수정 오류:', error);
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
 * DELETE /api/projects/[id]
 * 프로젝트 삭제
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 권한 확인 (admin 이상만 삭제 가능)
    if (!isAdmin(session.user.role as UserRole)) {
      return NextResponse.json(
        { success: false, error: '프로젝트 삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 프로젝트 찾기
    const result = await findRowByColumn<SheetProject>(
      SHEET_NAMES.PROJECTS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 삭제 이력 기록
    await recordHistory(id, 'deleted', '', 'true', session.user.id);

    // 시트에서 삭제
    await deleteRow(SHEET_NAMES.PROJECTS, result.rowIndex);

    return NextResponse.json({
      success: true,
      message: '프로젝트가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('프로젝트 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
