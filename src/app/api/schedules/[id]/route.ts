/**
 * 세부추진항목 상세 API Routes
 *
 * GET /api/schedules/[id] - 세부추진항목 상세 조회
 * PUT /api/schedules/[id] - 세부추진항목 수정
 * DELETE /api/schedules/[id] - 세부추진항목 삭제
 *
 * 권한: 로그인 필수, 수정/삭제는 팀장/관리자만
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  findRowByColumn,
  getHeaders,
  updateRow,
  deleteRow,
  objectToRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { ProjectSchedule, UpdateScheduleInput } from '@/types';

// 시트에서 가져온 세부추진항목 타입
interface SheetSchedule extends Record<string, unknown> {
  id: string;
  projectId: string;
  stage: string;
  taskName: string;
  category: string;
  responsibility: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  status: string;
  note: string;
  order: string;
  createdAt: string;
  updatedAt: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/schedules/[id]
 * 세부추진항목 상세 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 인증 확인
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 세부추진항목 조회
    const result = await findRowByColumn<SheetSchedule>(
      SHEET_NAMES.PROJECT_SCHEDULES,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '세부추진항목을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const s = result.data;

    // 타입 변환
    const schedule: ProjectSchedule = {
      id: s.id,
      projectId: s.projectId,
      stage: s.stage || undefined,
      taskName: s.taskName,
      category: s.category as ProjectSchedule['category'] || undefined,
      responsibility: s.responsibility as ProjectSchedule['responsibility'] || undefined,
      plannedStart: s.plannedStart,
      plannedEnd: s.plannedEnd,
      actualStart: s.actualStart || undefined,
      actualEnd: s.actualEnd || undefined,
      status: (s.status || 'planned') as ProjectSchedule['status'],
      note: s.note || undefined,
      order: parseInt(s.order || '0', 10),
    };

    return NextResponse.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error('세부추진항목 조회 오류:', error);
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
 * PUT /api/schedules/[id]
 * 세부추진항목 수정
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 인증 확인
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 권한 확인 (engineer, admin만 수정 가능)
    const userRole = session.user.role;
    if (!['engineer', 'admin', 'sysadmin'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: '세부추진항목 수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 바디 미리 파싱 (실적 날짜 권한 체크용)
    const body: UpdateScheduleInput = await request.json();

    // 실적 날짜 수정 권한 체크: sysadmin, admin만 가능
    const canEditActualDates = ['sysadmin', 'admin'].includes(userRole);
    if (!canEditActualDates && (body.actualStart !== undefined || body.actualEnd !== undefined)) {
      return NextResponse.json(
        { success: false, error: '실적 날짜 수정 권한이 없습니다. (관리자만 가능)' },
        { status: 403 }
      );
    }

    // 기존 데이터 조회
    const result = await findRowByColumn<SheetSchedule>(
      SHEET_NAMES.PROJECT_SCHEDULES,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '세부추진항목을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { rowIndex, data: existingSchedule } = result;

    const now = new Date().toISOString();

    // 업데이트할 데이터 병합
    const updatedSchedule: SheetSchedule = {
      ...existingSchedule,
      stage: body.stage ?? existingSchedule.stage,
      taskName: body.taskName ?? existingSchedule.taskName,
      category: body.category ?? existingSchedule.category,
      responsibility: body.responsibility ?? existingSchedule.responsibility,
      plannedStart: body.plannedStart ?? existingSchedule.plannedStart,
      plannedEnd: body.plannedEnd ?? existingSchedule.plannedEnd,
      actualStart: body.actualStart ?? existingSchedule.actualStart,
      actualEnd: body.actualEnd ?? existingSchedule.actualEnd,
      status: body.status ?? existingSchedule.status,
      note: body.note ?? existingSchedule.note,
      order: body.order !== undefined ? String(body.order) : existingSchedule.order,
      updatedAt: now,
    };

    // 시트 업데이트
    const headers = await getHeaders(SHEET_NAMES.PROJECT_SCHEDULES);
    const rowValues = objectToRow(headers, updatedSchedule);
    await updateRow(SHEET_NAMES.PROJECT_SCHEDULES, rowIndex, rowValues);

    // 응답 타입 변환
    const schedule: ProjectSchedule = {
      id: updatedSchedule.id,
      projectId: updatedSchedule.projectId,
      stage: updatedSchedule.stage || undefined,
      taskName: updatedSchedule.taskName,
      category: updatedSchedule.category as ProjectSchedule['category'] || undefined,
      responsibility: updatedSchedule.responsibility as ProjectSchedule['responsibility'] || undefined,
      plannedStart: updatedSchedule.plannedStart,
      plannedEnd: updatedSchedule.plannedEnd,
      actualStart: updatedSchedule.actualStart || undefined,
      actualEnd: updatedSchedule.actualEnd || undefined,
      status: (updatedSchedule.status || 'planned') as ProjectSchedule['status'],
      note: updatedSchedule.note || undefined,
      order: parseInt(updatedSchedule.order || '0', 10),
    };

    return NextResponse.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error('세부추진항목 수정 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

// 프로젝트 타입 (teamLeaderId 조회용)
interface SheetProject extends Record<string, unknown> {
  id: string;
  teamLeaderId: string;
}

/**
 * DELETE /api/schedules/[id]
 * 세부추진항목 삭제
 * 권한: 프로젝트 팀장 또는 sysadmin/admin만 가능
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 인증 확인
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const userRole = session.user.role;
    const userId = session.user.id;

    // 기존 데이터 조회
    const result = await findRowByColumn<SheetSchedule>(
      SHEET_NAMES.PROJECT_SCHEDULES,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '세부추진항목을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { rowIndex, data: schedule } = result;

    // 프로젝트 조회하여 팀장 확인
    const projectResult = await findRowByColumn<SheetProject>(
      SHEET_NAMES.PROJECTS,
      'id',
      schedule.projectId
    );

    const isTeamLeader = projectResult?.data.teamLeaderId === userId;
    const isAdmin = ['sysadmin', 'admin'].includes(userRole);

    // 권한 확인: 팀장 또는 관리자만 삭제 가능
    if (!isTeamLeader && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '세부추진항목 삭제 권한이 없습니다. (팀장 또는 관리자만 가능)' },
        { status: 403 }
      );
    }

    // 시트에서 삭제
    await deleteRow(SHEET_NAMES.PROJECT_SCHEDULES, rowIndex);

    return NextResponse.json({
      success: true,
      message: '세부추진항목이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('세부추진항목 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
