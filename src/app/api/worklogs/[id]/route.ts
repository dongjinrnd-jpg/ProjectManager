/**
 * 업무일지 상세 API Routes
 *
 * GET /api/worklogs/[id] - 업무일지 상세 조회
 * PUT /api/worklogs/[id] - 업무일지 수정
 * DELETE /api/worklogs/[id] - 업무일지 삭제
 *
 * 권한: 로그인 필수, 수정/삭제는 본인만
 */

import { NextResponse } from 'next/server';
import {
  findRowByColumn,
  updateRow,
  deleteRow,
  getHeaders,
  objectToRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { WorkLog, UpdateWorkLogInput, ProjectStage } from '@/types';

// 시트에서 가져온 업무일지 타입
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

// 시트에서 가져온 프로젝트 타입
interface SheetProject extends Record<string, unknown> {
  id: string;
  item: string;
  customer: string;
  issues: string;
  currentStage: ProjectStage;
  teamLeaderId: string;
}

// 시트에서 가져온 세부추진항목 타입
interface SheetSchedule extends Record<string, unknown> {
  id: string;
  projectId: string;
  stage: string;
  taskName: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  status: string;
}

/**
 * 세부추진항목 실적 날짜 자동 업데이트
 * - actualStart가 없으면 → worklog.date로 설정
 * - actualEnd는 항상 → worklog.date로 업데이트 (최신 업무일지 날짜)
 * - status는 in_progress로 유지 (완료 처리는 팀장/관리자가 별도 버튼으로)
 *
 * 간트 차트에서는 status 필드 기반으로 상태 판단:
 * - in_progress → 진행중 (주황색)
 * - completed → 완료 (초록색)
 */
async function updateScheduleActualDates(
  scheduleId: string,
  worklogDate: string
): Promise<void> {
  const result = await findRowByColumn<SheetSchedule>(
    SHEET_NAMES.PROJECT_SCHEDULES,
    'id',
    scheduleId
  );

  if (!result) {
    console.log(`세부추진항목을 찾을 수 없습니다: ${scheduleId}`);
    return;
  }

  const { rowIndex, data: schedule } = result;
  const headers = await getHeaders(SHEET_NAMES.PROJECT_SCHEDULES);

  const updatedSchedule = { ...schedule };

  // actualStart가 없으면 설정 (처음 업무일지 작성 시)
  if (!schedule.actualStart) {
    updatedSchedule.actualStart = worklogDate;
  }

  // actualEnd는 항상 최신 날짜로 업데이트 (실적 기간 표시용)
  updatedSchedule.actualEnd = worklogDate;

  // status 자동 업데이트 (planned → in_progress)
  // 완료 처리는 팀장/관리자가 "완료" 버튼으로 별도 처리
  if (schedule.status === 'planned') {
    updatedSchedule.status = 'in_progress';
  }

  const rowValues = objectToRow(headers, updatedSchedule);
  await updateRow(SHEET_NAMES.PROJECT_SCHEDULES, rowIndex, rowValues);
}

/**
 * 프로젝트 이슈사항 및 단계 업데이트
 */
async function updateProjectIssueAndStage(
  projectId: string,
  issue: string | undefined,
  issueStatus: string | undefined,
  newStage: ProjectStage | undefined,
  updateStage: boolean
): Promise<void> {
  const result = await findRowByColumn<SheetProject>(
    SHEET_NAMES.PROJECTS,
    'id',
    projectId
  );

  if (!result) return;

  const { rowIndex, data: project } = result;
  const headers = await getHeaders(SHEET_NAMES.PROJECTS);

  const updatedProject = { ...project };

  // 이슈사항 업데이트
  if (issue && issueStatus === 'open') {
    updatedProject.issues = issue;
  } else if (issueStatus === 'resolved') {
    updatedProject.issues = '';
  }

  // 단계 업데이트 (팀장이 변경 요청한 경우)
  if (updateStage && newStage && project.currentStage !== newStage) {
    updatedProject.currentStage = newStage;
  }

  updatedProject.updatedAt = new Date().toISOString();

  const rowValues = objectToRow(headers, updatedProject);
  await updateRow(SHEET_NAMES.PROJECTS, rowIndex, rowValues);
}

/**
 * GET /api/worklogs/[id]
 * 업무일지 상세 조회
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

    // 업무일지 찾기
    const result = await findRowByColumn<SheetWorkLog>(
      SHEET_NAMES.WORKLOGS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '업무일지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('업무일지 조회 오류:', error);
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
 * PUT /api/worklogs/[id]
 * 업무일지 수정
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

    // 업무일지 찾기
    const result = await findRowByColumn<SheetWorkLog>(
      SHEET_NAMES.WORKLOGS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '업무일지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { rowIndex, data: existingWorkLog } = result;

    // 권한 확인 (본인만 수정 가능)
    if (existingWorkLog.assigneeId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '본인이 작성한 업무일지만 수정할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body: UpdateWorkLogInput & {
      updateProjectStage?: boolean;
      scheduleId?: string;
    } = await request.json();

    // 프로젝트 변경 시 프로젝트 정보 가져오기
    let item = existingWorkLog.item;
    let customer = existingWorkLog.customer;

    if (body.projectId && body.projectId !== existingWorkLog.projectId) {
      const projectResult = await findRowByColumn<SheetProject>(
        SHEET_NAMES.PROJECTS,
        'id',
        body.projectId
      );

      if (!projectResult) {
        return NextResponse.json(
          { success: false, error: '존재하지 않는 프로젝트입니다.' },
          { status: 400 }
        );
      }

      item = projectResult.data.item;
      customer = projectResult.data.customer;
    }

    // 현재 시간
    const now = new Date().toISOString();

    // 이슈사항 해결 시 해결일시 설정
    const issueResolvedAt = body.issueStatus === 'resolved' && existingWorkLog.issueStatus !== 'resolved'
      ? now
      : existingWorkLog.issueResolvedAt;

    // 업데이트할 데이터 병합
    const updatedWorkLog: Record<string, unknown> = {
      ...existingWorkLog,
      date: body.date ?? existingWorkLog.date,
      projectId: body.projectId ?? existingWorkLog.projectId,
      item,
      customer,
      stage: body.stage ?? existingWorkLog.stage,
      participants: body.participants ?? existingWorkLog.participants,
      plan: body.plan ?? existingWorkLog.plan,
      content: body.content ?? existingWorkLog.content,
      issue: body.issue ?? existingWorkLog.issue,
      issueStatus: body.issue ? (body.issueStatus ?? existingWorkLog.issueStatus) : '',
      issueResolvedAt,
      scheduleId: body.scheduleId ?? existingWorkLog.scheduleId,
      updatedAt: now,
    };

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.WORKLOGS);

    // 행 데이터 생성
    const rowValues = objectToRow(headers, updatedWorkLog);

    // 시트 업데이트
    await updateRow(SHEET_NAMES.WORKLOGS, rowIndex, rowValues);

    // 프로젝트 이슈사항 및 단계 업데이트
    const finalProjectId = body.projectId ?? existingWorkLog.projectId;
    await updateProjectIssueAndStage(
      finalProjectId,
      body.issue ?? existingWorkLog.issue,
      body.issueStatus ?? existingWorkLog.issueStatus,
      body.stage ?? existingWorkLog.stage,
      body.updateProjectStage || false
    );

    // 세부추진항목 실적 날짜 자동 업데이트
    const finalScheduleId = body.scheduleId ?? existingWorkLog.scheduleId;
    const finalDate = body.date ?? existingWorkLog.date;
    if (finalScheduleId) {
      await updateScheduleActualDates(finalScheduleId, finalDate);
    }

    return NextResponse.json({
      success: true,
      data: updatedWorkLog as unknown as WorkLog,
      message: '업무일지가 수정되었습니다.',
    });
  } catch (error) {
    console.error('업무일지 수정 오류:', error);
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
 * DELETE /api/worklogs/[id]
 * 업무일지 삭제
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

    // 업무일지 찾기
    const result = await findRowByColumn<SheetWorkLog>(
      SHEET_NAMES.WORKLOGS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '업무일지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { rowIndex, data: existingWorkLog } = result;

    // 권한 확인 (본인만 삭제 가능)
    if (existingWorkLog.assigneeId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '본인이 작성한 업무일지만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 시트에서 삭제
    await deleteRow(SHEET_NAMES.WORKLOGS, rowIndex);

    return NextResponse.json({
      success: true,
      message: '업무일지가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('업무일지 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}