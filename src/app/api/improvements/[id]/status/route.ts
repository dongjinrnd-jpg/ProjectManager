/**
 * 개선요청 상태 변경 API
 *
 * PATCH /api/improvements/[id]/status - 상태 변경 (sysadmin 전용)
 *
 * 권한: sysadmin만 가능
 */

import { NextResponse } from 'next/server';
import {
  findRowByColumn,
  getAllAsObjects,
  updateById,
  insertRow,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type {
  Improvement,
  UpdateStatusInput,
  ImprovementType,
  ImprovementStatus,
  ImprovementPriority,
  RelatedMenu,
} from '@/types/improvement';

/**
 * PATCH /api/improvements/[id]/status
 * 상태 변경 (sysadmin 전용)
 */
export async function PATCH(
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

    // sysadmin 권한 확인
    if (session.user.role !== 'sysadmin') {
      return NextResponse.json(
        { success: false, error: '상태 변경 권한이 없습니다. (sysadmin 전용)' },
        { status: 403 }
      );
    }

    // 개선요청 조회
    const result = await findRowByColumn<Improvement & Record<string, unknown>>(
      SHEET_NAMES.IMPROVEMENTS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '개선요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 요청 본문 파싱
    const body: UpdateStatusInput = await request.json();

    // 필수 필드 검증
    if (!body.status || !body.memo) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다. (status, memo)' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 업데이트할 데이터
    const updatedImprovement: Record<string, unknown> = {
      ...result.data,
      status: body.status,
      priority: body.priority ?? result.data.priority,
      dueDate: body.dueDate ?? result.data.dueDate,
      updatedAt: now,
      // 완료 상태면 completedAt 설정
      completedAt: body.status === 'completed' ? now : result.data.completedAt,
    };

    // 행 업데이트
    await updateById(SHEET_NAMES.IMPROVEMENTS, id, updatedImprovement);

    // 처리 이력 추가
    await addHistory(
      id,
      body.status,
      body.memo,
      session.user.id,
      session.user.name || ''
    );

    return NextResponse.json({
      success: true,
      data: updatedImprovement as unknown as Improvement,
      message: '상태가 변경되었습니다.',
    });
  } catch (error) {
    console.error('상태 변경 오류:', error);
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
 * 처리 이력 추가
 */
async function addHistory(
  improvementId: string,
  status: ImprovementStatus,
  memo: string,
  changedBy: string,
  changedByName: string
): Promise<void> {
  const allHistories = await getAllAsObjects<{ id: string }>(SHEET_NAMES.IMPROVEMENT_HISTORIES);

  // 새 ID 생성
  let maxNum = 0;
  for (const row of allHistories) {
    if (row.id && row.id.startsWith('IMPH-')) {
      const num = parseInt(row.id.replace('IMPH-', ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const historyId = `IMPH-${String(maxNum + 1).padStart(5, '0')}`;

  const now = new Date().toISOString();

  const historyData: Record<string, unknown> = {
    id: historyId,
    improvementId,
    status,
    memo,
    changedBy,
    changedByName,
    changedAt: now,
  };

  await insertRow(SHEET_NAMES.IMPROVEMENT_HISTORIES, historyData);
}
