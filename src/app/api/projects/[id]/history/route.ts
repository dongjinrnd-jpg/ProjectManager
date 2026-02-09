/**
 * 프로젝트 이력 API
 *
 * GET /api/projects/[id]/history - 프로젝트 변경 이력 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllAsObjects, SHEET_NAMES } from '@/lib/google';
import { getSession } from '@/lib/auth';

// 시트에서 가져온 이력 타입
interface SheetProjectHistory extends Record<string, unknown> {
  id: string;
  projectId: string;
  changedField: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

/**
 * GET /api/projects/[id]/history
 * 프로젝트 변경 이력 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: '프로젝트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 프로젝트 이력 조회
    const allHistory = await getAllAsObjects<SheetProjectHistory>(
      SHEET_NAMES.PROJECT_HISTORY
    );

    // 해당 프로젝트의 이력만 필터링
    const projectHistory = allHistory
      .filter((h) => h.projectId === projectId)
      .sort((a, b) => {
        // 최신순 정렬
        const dateA = new Date(a.changedAt || '1970-01-01');
        const dateB = new Date(b.changedAt || '1970-01-01');
        return dateB.getTime() - dateA.getTime();
      });

    return NextResponse.json({
      success: true,
      data: projectHistory,
    });
  } catch (error) {
    console.error('프로젝트 이력 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}