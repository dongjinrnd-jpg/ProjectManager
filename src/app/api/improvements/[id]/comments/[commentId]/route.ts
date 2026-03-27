/**
 * 개선요청 댓글 삭제 API
 *
 * DELETE /api/improvements/[id]/comments/[commentId] - 댓글 삭제
 *
 * 권한: 작성자 또는 sysadmin
 */

import { NextResponse } from 'next/server';
import {
  findRowByColumn,
  deleteById,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';

// 허용된 역할 확인
function hasAccess(role: string): boolean {
  return ['engineer', 'admin', 'sysadmin'].includes(role);
}

// 삭제 권한 확인
function canDelete(userId: string, authorId: string, role: string): boolean {
  return userId === authorId || role === 'sysadmin';
}

/**
 * DELETE /api/improvements/[id]/comments/[commentId]
 * 댓글 삭제
 */
export async function DELETE(
  request: Request,
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

    // 권한 확인
    if (!hasAccess(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 댓글 조회
    const result = await findRowByColumn<{
      id: string;
      improvementId: string;
      content: string;
      authorId: string;
      authorName: string;
      createdAt: string;
    }>(
      SHEET_NAMES.IMPROVEMENT_COMMENTS,
      'id',
      commentId
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 개선요청 ID 확인
    if (result.data.improvementId !== id) {
      return NextResponse.json(
        { success: false, error: '해당 개선요청의 댓글이 아닙니다.' },
        { status: 400 }
      );
    }

    // 삭제 권한 확인
    if (!canDelete(session.user.id, result.data.authorId, session.user.role)) {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 행 삭제
    await deleteById(SHEET_NAMES.IMPROVEMENT_COMMENTS, commentId);

    return NextResponse.json({
      success: true,
      message: '댓글이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
