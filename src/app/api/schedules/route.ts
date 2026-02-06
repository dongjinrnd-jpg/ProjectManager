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
  appendRow,
  getHeaders,
  getRows,
  objectToRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { ProjectSchedule, CreateScheduleInput } from '@/types';

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

/**
 * 새 세부추진항목 ID 생성
 * 형식: PS-NNN
 */
async function generateScheduleId(): Promise<string> {
  const prefix = 'PS-';
  const rows = await getRows(SHEET_NAMES.PROJECT_SCHEDULES);

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
 * 프로젝트별 세부추진항목의 최대 order 조회
 */
async function getMaxOrder(projectId: string): Promise<number> {
  const allSchedules = await getAllAsObjects<SheetSchedule>(SHEET_NAMES.PROJECT_SCHEDULES);
  const projectSchedules = allSchedules.filter((s) => s.projectId === projectId);

  if (projectSchedules.length === 0) return 0;

  return Math.max(...projectSchedules.map((s) => parseInt(s.order || '0', 10)));
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

    // 세부추진항목 조회
    const allSchedules = await getAllAsObjects<SheetSchedule>(SHEET_NAMES.PROJECT_SCHEDULES);

    // 프로젝트별 필터링 및 정렬
    const projectSchedules = allSchedules
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => parseInt(a.order || '0', 10) - parseInt(b.order || '0', 10));

    // 타입 변환
    const schedules: ProjectSchedule[] = projectSchedules.map((s) => ({
      id: s.id,
      projectId: s.projectId,
      stage: s.stage || undefined,
      taskName: s.taskName,
      category: s.category as ProjectSchedule['category'],
      responsibility: s.responsibility as ProjectSchedule['responsibility'],
      plannedStart: s.plannedStart,
      plannedEnd: s.plannedEnd,
      actualStart: s.actualStart || undefined,
      actualEnd: s.actualEnd || undefined,
      status: (s.status || 'planned') as ProjectSchedule['status'],
      note: s.note || undefined,
      order: parseInt(s.order || '0', 10),
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
    const newSchedule: SheetSchedule = {
      id,
      projectId: body.projectId,
      stage: body.stage || '',
      taskName: body.taskName,
      category: body.category || '',
      responsibility: body.responsibility || '',
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
    const headers = await getHeaders(SHEET_NAMES.PROJECT_SCHEDULES);
    const rowValues = objectToRow(headers, newSchedule);
    await appendRow(SHEET_NAMES.PROJECT_SCHEDULES, rowValues);

    // 응답 타입 변환
    const schedule: ProjectSchedule = {
      id: newSchedule.id,
      projectId: newSchedule.projectId,
      stage: newSchedule.stage || undefined,
      taskName: newSchedule.taskName,
      category: newSchedule.category as ProjectSchedule['category'] || undefined,
      responsibility: newSchedule.responsibility as ProjectSchedule['responsibility'] || undefined,
      plannedStart: newSchedule.plannedStart,
      plannedEnd: newSchedule.plannedEnd,
      status: 'planned',
      note: newSchedule.note || undefined,
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