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
  getHeaders,
  getRows,
  updateRow,
  appendRow,
  objectToRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type {
  Improvement,
  UpdateStatusInput,
  ImprovementType,
  ImprovementStatus,
  ImprovementPriority,
  RelatedMenu,
} from '@/types/improvement';

// 시트에서 가져온 개선요청 타입
interface SheetImprovement extends Record<string, unknown> {
  id: string;
  title: string;
  type: ImprovementType;
  status: ImprovementStatus;
  priority: ImprovementPriority;
  content: string;
  relatedMenu: RelatedMenu;
  reproductionSteps: string;
  screenshotUrl: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  completedAt: string;
}

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
    const result = await findRowByColumn<SheetImprovement>(
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
    const updatedImprovement: SheetImprovement = {
      ...result.data,
      status: body.status,
      priority: body.priority ?? result.data.priority,
      dueDate: body.dueDate ?? result.data.dueDate,
      updatedAt: now,
      // 완료 상태면 completedAt 설정
      completedAt: body.status === 'completed' ? now : result.data.completedAt,
    };

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.IMPROVEMENTS);

    // 행 업데이트
    const rowValues = objectToRow(headers, updatedImprovement);
    await updateRow(SHEET_NAMES.IMPROVEMENTS, result.rowIndex, rowValues);

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
  const headers = await getHeaders(SHEET_NAMES.IMPROVEMENT_HISTORIES);
  const rows = await getRows(SHEET_NAMES.IMPROVEMENT_HISTORIES);

  // 새 ID 생성
  let maxNum = 0;
  for (const row of rows) {
    if (row[0] && row[0].startsWith('IMPH-')) {
      const num = parseInt(row[0].replace('IMPH-', ''), 10);
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

  const rowValues = headers.map((header) => {
    const value = historyData[header];
    if (value === null || value === undefined) return '';
    return String(value);
  });

  await appendRow(SHEET_NAMES.IMPROVEMENT_HISTORIES, rowValues);
}
