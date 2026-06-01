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
  updateById,
  deleteById,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { ProjectSchedule, UpdateScheduleInput } from '@/types';

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
    const result = await findRowByColumn<Record<string, unknown>>(
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
      id: s.id as string,
      projectId: s.projectId as string,
      stage: (s.stage as string) || undefined,
      taskName: s.taskName as string,
      category: s.category as ProjectSchedule['category'] || undefined,
      responsibility: s.responsibility as ProjectSchedule['responsibility'] || undefined,
      assigneeId: (s.assigneeId as string) || undefined,
      plannedStart: s.plannedStart as string,
      plannedEnd: s.plannedEnd as string,
      actualStart: (s.actualStart as string) || undefined,
      actualEnd: (s.actualEnd as string) || undefined,
      status: ((s.status as string) || 'planned') as ProjectSchedule['status'],
      note: (s.note as string) || undefined,
      order: parseInt((s.order as string) || '0', 10),
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

    // 권한 확인 (engineer, admin만 수정 가능 / 시스템관리자는 일정 수정 불가)
    const userRole = session.user.role;
    if (!['engineer', 'admin'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: '세부추진항목 수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 바디 미리 파싱 (실적 날짜 권한 체크용)
    const body: UpdateScheduleInput = await request.json();

    // 실적 날짜 수정 권한 체크: admin만 가능
    const canEditActualDates = userRole === 'admin';
    if (!canEditActualDates && (body.actualStart !== undefined || body.actualEnd !== undefined)) {
      return NextResponse.json(
        { success: false, error: '실적 날짜 수정 권한이 없습니다. (관리자만 가능)' },
        { status: 403 }
      );
    }

    // 기존 데이터 조회
    const result = await findRowByColumn<Record<string, unknown>>(
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

    const { data: existingSchedule } = result;

    const now = new Date().toISOString();

    // 업데이트할 데이터 병합
    const updatedSchedule: Record<string, unknown> = {
      ...existingSchedule,
      stage: body.stage ?? existingSchedule.stage,
      taskName: body.taskName ?? existingSchedule.taskName,
      category: body.category ?? existingSchedule.category,
      responsibility: body.responsibility ?? existingSchedule.responsibility,
      assigneeId: body.assigneeId ?? existingSchedule.assigneeId,
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
    await updateById(SHEET_NAMES.PROJECT_SCHEDULES, id, updatedSchedule);

    // 응답 타입 변환
    const schedule: ProjectSchedule = {
      id: updatedSchedule.id as string,
      projectId: updatedSchedule.projectId as string,
      stage: (updatedSchedule.stage as string) || undefined,
      taskName: updatedSchedule.taskName as string,
      category: updatedSchedule.category as ProjectSchedule['category'] || undefined,
      responsibility: updatedSchedule.responsibility as ProjectSchedule['responsibility'] || undefined,
      assigneeId: (updatedSchedule.assigneeId as string) || undefined,
      plannedStart: updatedSchedule.plannedStart as string,
      plannedEnd: updatedSchedule.plannedEnd as string,
      actualStart: (updatedSchedule.actualStart as string) || undefined,
      actualEnd: (updatedSchedule.actualEnd as string) || undefined,
      status: ((updatedSchedule.status as string) || 'planned') as ProjectSchedule['status'],
      note: (updatedSchedule.note as string) || undefined,
      order: parseInt((updatedSchedule.order as string) || '0', 10),
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
    const result = await findRowByColumn<Record<string, unknown>>(
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

    const { data: schedule } = result;

    // 프로젝트 조회하여 팀장 확인
    const projectResult = await findRowByColumn<Record<string, unknown>>(
      SHEET_NAMES.PROJECTS,
      'id',
      schedule.projectId as string
    );

    const isTeamLeader = projectResult?.data.teamLeaderId === userId;
    const isAdminRole = ['sysadmin', 'admin'].includes(userRole);

    // 권한 확인: 팀장 또는 관리자만 삭제 가능
    if (!isTeamLeader && !isAdminRole) {
      return NextResponse.json(
        { success: false, error: '세부추진항목 삭제 권한이 없습니다. (팀장 또는 관리자만 가능)' },
        { status: 403 }
      );
    }

    // 시트에서 삭제
    await deleteById(SHEET_NAMES.PROJECT_SCHEDULES, id);

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
