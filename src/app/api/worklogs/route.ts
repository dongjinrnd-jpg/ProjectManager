/**
 * 업무일지 API Routes
 *
 * GET /api/worklogs - 업무일지 목록 조회
 * POST /api/worklogs - 업무일지 생성
 *
 * 권한: 로그인 필수, 모든 직원 열람 가능, 생성은 본인만
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  findRowByColumn,
  insertRow,
  updateById,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { WorkLog, CreateWorkLogInput, ProjectStage } from '@/types';

/**
 * 새 업무일지 ID 생성
 * 형식: WL-YYYYMMDD-NNN
 */
async function generateWorkLogId(date: string): Promise<string> {
  const dateStr = date.replace(/-/g, '');
  const prefix = `WL-${dateStr}-`;
  const allWorklogs = await getAllAsObjects<{ id: string }>(SHEET_NAMES.WORKLOGS);

  let maxNum = 0;
  for (const row of allWorklogs) {
    if (row.id && row.id.startsWith(prefix)) {
      const num = parseInt(row.id.replace(prefix, ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * 프로젝트 업무진행사항 업데이트
 */
async function updateProjectProgress(
  projectId: string,
  newContent: string
): Promise<void> {
  const result = await findRowByColumn<Record<string, unknown>>(
    SHEET_NAMES.PROJECTS,
    'id',
    projectId
  );

  if (!result) return;

  const { data: project } = result;

  // 기존 progress에 새 내용 추가 (최신 내용이 위로)
  const existingProgress = (project.progress as string) || '';
  const updatedProgress = newContent + (existingProgress ? '\n---\n' + existingProgress : '');

  await updateById(SHEET_NAMES.PROJECTS, projectId, {
    progress: updatedProgress,
    updatedAt: new Date().toISOString(),
  });
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
  const result = await findRowByColumn<Record<string, unknown>>(
    SHEET_NAMES.PROJECTS,
    'id',
    projectId
  );

  if (!result) return;

  const { data: project } = result;

  const updatedFields: Record<string, unknown> = {};

  // 이슈사항 업데이트
  if (issue && issueStatus === 'open') {
    // 새 이슈사항 또는 미해결 이슈사항 → 프로젝트에 반영
    updatedFields.issues = issue;
  } else if (issueStatus === 'resolved') {
    // 해결됨 → 프로젝트 이슈사항 클리어
    updatedFields.issues = '';
  }

  // 단계 업데이트 (팀장이 변경 요청한 경우)
  if (updateStage && newStage && project.currentStage !== newStage) {
    updatedFields.currentStage = newStage;
  }

  updatedFields.updatedAt = new Date().toISOString();

  await updateById(SHEET_NAMES.PROJECTS, projectId, updatedFields);
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
  const result = await findRowByColumn<Record<string, unknown>>(
    SHEET_NAMES.PROJECT_SCHEDULES,
    'id',
    scheduleId
  );

  if (!result) {
    console.log(`세부추진항목을 찾을 수 없습니다: ${scheduleId}`);
    return;
  }

  const { data: schedule } = result;

  const updatedFields: Record<string, unknown> = {};

  // actualStart가 없으면 설정 (처음 업무일지 작성 시)
  if (!schedule.actualStart) {
    updatedFields.actualStart = worklogDate;
  }

  // actualEnd는 항상 최신 날짜로 업데이트 (실적 기간 표시용)
  updatedFields.actualEnd = worklogDate;

  // status 자동 업데이트 (planned → in_progress)
  // 완료 처리는 팀장/관리자가 "완료" 버튼으로 별도 처리
  if (schedule.status === 'planned') {
    updatedFields.status = 'in_progress';
  }

  await updateById(SHEET_NAMES.PROJECT_SCHEDULES, scheduleId, updatedFields);
}

/**
 * GET /api/worklogs
 * 업무일지 목록 조회
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
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const projectId = searchParams.get('projectId') || '';
    const assigneeId = searchParams.get('assigneeId') || '';
    const stage = searchParams.get('stage') as ProjectStage | null;
    const keyword = searchParams.get('keyword') || '';

    // 모든 업무일지 조회
    const allWorkLogs = await getAllAsObjects<Record<string, unknown>>(SHEET_NAMES.WORKLOGS);

    // 필터링
    let workLogs = allWorkLogs.filter((log) => {
      // 시작 날짜 필터
      if (startDate && (log.date as string) < startDate) {
        return false;
      }

      // 종료 날짜 필터
      if (endDate && (log.date as string) > endDate) {
        return false;
      }

      // 프로젝트 필터
      if (projectId && log.projectId !== projectId) {
        return false;
      }

      // 담당자 필터
      if (assigneeId && log.assigneeId !== assigneeId) {
        return false;
      }

      // 단계 필터
      if (stage && log.stage !== stage) {
        return false;
      }

      // 키워드 검색 (내용, 계획)
      if (keyword) {
        const keywordLower = keyword.toLowerCase();
        if (
          !(log.content as string).toLowerCase().includes(keywordLower) &&
          !((log.plan as string) || '').toLowerCase().includes(keywordLower) &&
          !(log.item as string).toLowerCase().includes(keywordLower) &&
          !(log.customer as string).toLowerCase().includes(keywordLower)
        ) {
          return false;
        }
      }

      return true;
    });

    // 최신순 정렬 (날짜 기준, 같은 날짜면 생성일시 기준)
    workLogs.sort((a, b) => {
      const dateCompare = (b.date as string).localeCompare(a.date as string);
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime();
    });

    return NextResponse.json({
      success: true,
      data: workLogs,
      total: workLogs.length,
    });
  } catch (error) {
    console.error('업무일지 목록 조회 오류:', error);
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
 * POST /api/worklogs
 * 업무일지 생성
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

    // 요청 본문 파싱
    const body: CreateWorkLogInput = await request.json();

    // 필수 필드 검증
    if (!body.date || !body.projectId || !body.stage || !body.content) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다. (date, projectId, stage, content)' },
        { status: 400 }
      );
    }

    // 프로젝트 존재 확인 및 정보 가져오기
    const projectResult = await findRowByColumn<Record<string, unknown>>(
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

    const project = projectResult.data;

    // 새 ID 생성
    const workLogId = await generateWorkLogId(body.date);

    // 현재 시간
    const now = new Date().toISOString();

    // 확장된 body 타입 (updateProjectStage, scheduleId 포함)
    const extendedBody = body as CreateWorkLogInput & {
      issue?: string;
      issueStatus?: string;
      updateProjectStage?: boolean;
      scheduleId?: string;
    };

    // 새 업무일지 데이터
    const newWorkLog: Record<string, unknown> = {
      id: workLogId,
      date: body.date,
      projectId: body.projectId,
      item: project.item,
      customer: project.customer,
      stage: body.stage,
      assigneeId: session.user.id, // 담당자는 로그인한 사용자
      participants: body.participants || '', // 참여자 (쉼표 구분)
      plan: body.plan || '',
      content: body.content,
      issue: extendedBody.issue || '',
      issueStatus: extendedBody.issue ? (extendedBody.issueStatus || 'open') : '',
      issueResolvedAt: '',
      scheduleId: extendedBody.scheduleId || '', // 세부추진항목 ID (실적 연동)
      createdAt: now,
      updatedAt: now,
    };

    // 시트에 추가
    await insertRow(SHEET_NAMES.WORKLOGS, newWorkLog);

    // 프로젝트 업무진행사항 업데이트
    const progressEntry = `[${body.date}] ${body.stage}: ${body.content}`;
    await updateProjectProgress(body.projectId, progressEntry);

    // 프로젝트 이슈사항 및 단계 업데이트
    await updateProjectIssueAndStage(
      body.projectId,
      extendedBody.issue,
      extendedBody.issueStatus,
      body.stage,
      extendedBody.updateProjectStage || false
    );

    // 세부추진항목 실적 날짜 자동 업데이트
    if (extendedBody.scheduleId) {
      await updateScheduleActualDates(extendedBody.scheduleId, body.date);
    }

    return NextResponse.json({
      success: true,
      data: newWorkLog as unknown as WorkLog,
      message: '업무일지가 생성되었습니다.',
    });
  } catch (error) {
    console.error('업무일지 생성 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
