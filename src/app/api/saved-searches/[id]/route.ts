/**
 * 저장된 검색 개별 API
 *
 * DELETE /api/saved-searches/[id] - 저장된 검색 삭제
 *
 * 권한: 본인 것만 삭제 가능
 */

import { NextResponse } from 'next/server';
import { findRowByColumn, deleteRow, SHEET_NAMES } from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { SavedSearch } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/saved-searches/[id]
 * 저장된 검색 삭제
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const userId = session.user.id;

    // 저장된 검색 찾기
    const result = await findRowByColumn<SavedSearch>(
      SHEET_NAMES.SAVED_SEARCHES,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '저장된 검색을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 본인 것인지 확인
    if (result.data.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '본인의 저장된 검색만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 삭제
    await deleteRow(SHEET_NAMES.SAVED_SEARCHES, result.rowIndex);

    return NextResponse.json({
      success: true,
      message: '검색 조건이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('저장된 검색 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
