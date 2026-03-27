/**
 * 업무일지 댓글 삭제 API
 *
 * DELETE /api/worklogs/[id]/comments/[commentId] - 댓글 삭제
 *
 * 권한: 작성자 본인만
 * 대댓글이 있는 부모 댓글은 삭제 불가
 */

import { NextResponse } from 'next/server';
import {
  findRowByColumn,
  getAllAsObjects,
  deleteById,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';

/**
 * DELETE /api/worklogs/[id]/comments/[commentId]
 * 댓글 삭제 (본인만, 대댓글 있으면 삭제 불가)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id, commentId } = await params;

    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 댓글 조회
    const result = await findRowByColumn<Record<string, unknown>>(
      SHEET_NAMES.WORKLOG_COMMENTS,
      'id',
      commentId
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 업무일지 ID 확인
    if (result.data.worklogId !== id) {
      return NextResponse.json(
        { success: false, error: '해당 업무일지의 댓글이 아닙니다.' },
        { status: 400 }
      );
    }

    // 삭제 권한 확인: 작성자 본인만
    if (session.user.id !== result.data.authorId) {
      return NextResponse.json(
        { success: false, error: '본인이 작성한 댓글만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 부모 댓글인 경우 대댓글 존재 여부 확인
    if (!result.data.parentId) {
      const allComments = await getAllAsObjects<Record<string, unknown>>(
        SHEET_NAMES.WORKLOG_COMMENTS
      );

      const hasReplies = allComments.some((c) => c.parentId === commentId);

      if (hasReplies) {
        return NextResponse.json(
          { success: false, error: '답글이 있는 댓글은 삭제할 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    // 댓글 삭제
    await deleteById(SHEET_NAMES.WORKLOG_COMMENTS, commentId);

    return NextResponse.json({
      success: true,
      message: '댓글이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('업무일지 댓글 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
