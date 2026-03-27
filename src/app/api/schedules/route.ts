/**
 * 세부추진항목 API Routes
 *
 * GET /api/schedules?projectId=xxx - 프로젝트별 세부추진항목 목록 조회
 * POST /api/schedules - 세부추진항목 생성
 *
 * 권한: 로그인 필수, 팀장/관리자만 생성 가능
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllAsObjects,
  insertRow,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { ProjectSchedule, CreateScheduleInput } from '@/types';

/**
 * 새 세부추진항목 ID 생성
 * 형식: PS-NNN
 */
async function generateScheduleId(): Promise<string> {
  const prefix = 'PS-';
  const allSchedules = await getAllAsObjects<{ id: string }>(SHEET_NAMES.PROJECT_SCHEDULES);

  let maxNum = 0;
  for (const row of allSchedules) {
    if (row.id && row.id.startsWith(prefix)) {
      const num = parseInt(row.id.replace(prefix, ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * 프로젝트별 세부추진항목의 최대 order 조회
 */
async function getMaxOrder(projectId: string): Promise<number> {
  const allSchedules = await getAllAsObjects<Record<string, unknown>>(SHEET_NAMES.PROJECT_SCHEDULES);
  const projectSchedules = allSchedules.filter((s) => s.projectId === projectId);

  if (projectSchedules.length === 0) return 0;

  return Math.max(...projectSchedules.map((s) => parseInt((s.order as string) || '0', 10)));
}

/**
 * GET /api/schedules
 * 세부추진항목 목록 조회 (프로젝트별)
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 프로젝트 정보 조회 (단계 순서 확인용)
    const allProjects = await getAllAsObjects<Record<string, unknown>>(SHEET_NAMES.PROJECTS);
    const project = allProjects.find((p) => p.id === projectId);
    const stagesRaw = project?.stages as string | undefined;
    const stageOrder = stagesRaw
      ? stagesRaw.split(',').map((s) => s.trim())
      : [];

    // 세부추진항목 조회
    const allSchedules = await getAllAsObjects<Record<string, unknown>>(SHEET_NAMES.PROJECT_SCHEDULES);

    // 프로젝트별 필터링 및 정렬: 단계순 → 계획시작일순 → 등록순
    const projectSchedules = allSchedules
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => {
        // 1차: 단계 순서
        const stageA = stageOrder.indexOf((a.stage as string) || '');
        const stageB = stageOrder.indexOf((b.stage as string) || '');
        const safeStageA = stageA === -1 ? stageOrder.length : stageA;
        const safeStageB = stageB === -1 ? stageOrder.length : stageB;
        if (safeStageA !== safeStageB) return safeStageA - safeStageB;
        // 2차: 계획시작일 오름차순
        const dateCompare = ((a.plannedStart as string) || '').localeCompare((b.plannedStart as string) || '');
        if (dateCompare !== 0) return dateCompare;
        // 3차: 등록순
        return parseInt((a.order as string) || '0', 10) - parseInt((b.order as string) || '0', 10);
      });

    // 타입 변환
    const schedules: ProjectSchedule[] = projectSchedules.map((s) => ({
      id: s.id as string,
      projectId: s.projectId as string,
      stage: (s.stage as string) || undefined,
      taskName: s.taskName as string,
      category: s.category as ProjectSchedule['category'],
      responsibility: s.responsibility as ProjectSchedule['responsibility'],
      assigneeId: (s.assigneeId as string) || undefined,
      plannedStart: s.plannedStart as string,
      plannedEnd: s.plannedEnd as string,
      actualStart: (s.actualStart as string) || undefined,
      actualEnd: (s.actualEnd as string) || undefined,
      status: ((s.status as string) || 'planned') as ProjectSchedule['status'],
      note: (s.note as string) || undefined,
      order: parseInt((s.order as string) || '0', 10),
    }));

    return NextResponse.json({
      success: true,
      data: schedules,
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
 * POST /api/schedules
 * 세부추진항목 생성
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 권한 확인 (engineer, admin만 생성 가능)
    const userRole = session.user.role;
    if (!['engineer', 'admin'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: '세부추진항목 생성 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 바디 파싱
    const body: CreateScheduleInput = await request.json();

    // 필수 필드 검증
    if (!body.projectId || !body.taskName || !body.plannedStart || !body.plannedEnd) {
      return NextResponse.json(
        { success: false, error: '필수 항목이 누락되었습니다.' },
        { status: 400 }
      );
    }

    // ID 생성
    const id = await generateScheduleId();

    // 순서 결정 (마지막 + 1)
    const maxOrder = await getMaxOrder(body.projectId);
    const order = maxOrder + 1;

    const now = new Date().toISOString();

    // 새 세부추진항목 데이터
    const newSchedule: Record<string, unknown> = {
      id,
      projectId: body.projectId,
      stage: body.stage || '',
      taskName: body.taskName,
      category: body.category || '',
      responsibility: body.responsibility || '',
      assigneeId: body.assigneeId || '',
      plannedStart: body.plannedStart,
      plannedEnd: body.plannedEnd,
      actualStart: '',
      actualEnd: '',
      status: 'planned',
      note: body.note || '',
      order: String(order),
      createdAt: now,
      updatedAt: now,
    };

    // 시트에 추가
    await insertRow(SHEET_NAMES.PROJECT_SCHEDULES, newSchedule);

    // 응답 타입 변환
    const schedule: ProjectSchedule = {
      id: newSchedule.id as string,
      projectId: newSchedule.projectId as string,
      stage: (newSchedule.stage as string) || undefined,
      taskName: newSchedule.taskName as string,
      category: newSchedule.category as ProjectSchedule['category'] || undefined,
      responsibility: newSchedule.responsibility as ProjectSchedule['responsibility'] || undefined,
      assigneeId: (newSchedule.assigneeId as string) || undefined,
      plannedStart: newSchedule.plannedStart as string,
      plannedEnd: newSchedule.plannedEnd as string,
      status: 'planned',
      note: (newSchedule.note as string) || undefined,
      order,
    };

    return NextResponse.json(
      {
        success: true,
        data: schedule,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('세부추진항목 생성 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
