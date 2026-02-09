/**
 * 주간 보고 순서 변경 API
 *
 * PUT /api/weekly-reports/reorder - 주간 보고 순서 일괄 변경
 *
 * 권한: admin만 가능
 */

import { NextResponse } from 'next/server';
import {
  findRowByColumn,
  updateRow,
  getHeaders,
  objectToRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';

// 시트에서 가져온 주간 보고 타입
interface SheetWeeklyReport extends Record<string, unknown> {
  id: string;
  order: number;
}

interface ReorderItem {
  id: string;
  order: number;
}

/**
 * PUT /api/weekly-reports/reorder
 * 주간 보고 순서 일괄 변경
 */
export async function PUT(request: Request) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 권한 확인 (admin만 순서 변경 가능)
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '순서 변경 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body: { items: ReorderItem[] } = await request.json();

    if (!body.items || !Array.isArray(body.items)) {
      return NextResponse.json(
        { success: false, error: 'items 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.WEEKLY_REPORTS);

    // 현재 시간
    const now = new Date().toISOString();

    // 각 항목 순서 업데이트
    for (const item of body.items) {
      const result = await findRowByColumn<SheetWeeklyReport>(
        SHEET_NAMES.WEEKLY_REPORTS,
        'id',
        item.id
      );

      if (result) {
        const { rowIndex, data: report } = result;

        const updatedReport: Record<string, unknown> = {
          ...report,
          order: item.order,
          updatedAt: now,
        };

        const rowValues = objectToRow(headers, updatedReport);
        await updateRow(SHEET_NAMES.WEEKLY_REPORTS, rowIndex, rowValues);
      }
    }

    return NextResponse.json({
      success: true,
      message: '순서가 변경되었습니다.',
    });
  } catch (error) {
    console.error('주간 보고 순서 변경 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}