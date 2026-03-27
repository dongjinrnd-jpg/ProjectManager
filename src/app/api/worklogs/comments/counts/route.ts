/**
 * 업무일지 댓글 수 일괄 조회 API
 *
 * GET /api/worklogs/comments/counts?worklogIds=WL-001,WL-002,...
 *
 * 권한: 모든 로그인 사용자
 */

import { NextResponse } from 'next/server';
import { query, SHEET_NAMES } from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';

// 시트에서 가져온 댓글 타입 (count용 최소 필드)
interface SheetComment extends Record<string, unknown> {
  id: string;
  worklogId: string;
}

/**
 * GET /api/worklogs/comments/counts
 * 업무일지별 댓글 수 일괄 조회
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

    const { searchParams } = new URL(request.url);
    const worklogIdsParam = searchParams.get('worklogIds');

    if (!worklogIdsParam) {
      return NextResponse.json({
        success: true,
        data: {},
      });
    }

    const worklogIds = worklogIdsParam.split(',').filter(Boolean);

    if (worklogIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {},
      });
    }

    // 해당 worklogId들의 댓글만 서버사이드 필터링
    let filteredComments: SheetComment[] = [];
    try {
      filteredComments = await query<SheetComment>(
        SHEET_NAMES.WORKLOG_COMMENTS,
        {
          filters: [{ column: 'worklogId', op: 'in', value: worklogIds }],
        }
      );
    } catch {
      // 테이블이 아직 없는 경우 빈 배열
      filteredComments = [];
    }

    // worklogId별 댓글 수 계산
    const counts: Record<string, number> = {};
    for (const wlId of worklogIds) {
      counts[wlId] = filteredComments.filter((c) => c.worklogId === wlId).length;
    }

    return NextResponse.json({
      success: true,
      data: counts,
    });
  } catch (error) {
    console.error('업무일지 댓글 수 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
