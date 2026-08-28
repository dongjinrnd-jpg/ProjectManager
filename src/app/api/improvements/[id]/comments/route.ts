/**
 * 개선요청 댓글 API Routes
 *
 * GET /api/improvements/[id]/comments - 댓글 목록 조회
 * POST /api/improvements/[id]/comments - 댓글 등록
 *
 * 권한: engineer, admin, sysadmin
 */

import { NextResponse } from 'next/server';
import {
  findRowByColumn,
  getAllAsObjects,
  insertRow,
  SHEET_NAMES,
  generateSequentialId,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type {
  ImprovementComment,
  CreateCommentInput,
} from '@/types/improvement';

// 허용된 역할 확인
function hasAccess(role: string): boolean {
  return ['engineer', 'admin', 'sysadmin'].includes(role);
}

/**
 * GET /api/improvements/[id]/comments
 * 댓글 목록 조회
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

    // 권한 확인
    if (!hasAccess(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 개선요청 존재 확인
    const improvement = await findRowByColumn<{ id: string }>(
      SHEET_NAMES.IMPROVEMENTS,
      'id',
      id
    );

    if (!improvement) {
      return NextResponse.json(
        { success: false, error: '개선요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 댓글 조회
    const allComments = await getAllAsObjects<ImprovementComment & Record<string, unknown>>(
      SHEET_NAMES.IMPROVEMENT_COMMENTS
    );

    const comments: ImprovementComment[] = allComments
      .filter((c) => c.improvementId === id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return NextResponse.json({
      success: true,
      data: comments,
      total: comments.length,
    });
  } catch (error) {
    console.error('댓글 목록 조회 오류:', error);
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
 * POST /api/improvements/[id]/comments
 * 댓글 등록
 */
export async function POST(
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

    // 권한 확인
    if (!hasAccess(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 개선요청 존재 확인
    const improvement = await findRowByColumn<{ id: string }>(
      SHEET_NAMES.IMPROVEMENTS,
      'id',
      id
    );

    if (!improvement) {
      return NextResponse.json(
        { success: false, error: '개선요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 요청 본문 파싱
    const body: CreateCommentInput = await request.json();

    // 필수 필드 검증
    if (!body.content) {
      return NextResponse.json(
        { success: false, error: '댓글 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 새 ID 생성
    const commentId = await generateSequentialId(SHEET_NAMES.IMPROVEMENT_COMMENTS, 'IMPC-', 5);

    const now = new Date().toISOString();

    // 새 댓글 데이터
    const newComment: Record<string, unknown> = {
      id: commentId,
      improvementId: id,
      content: body.content,
      authorId: session.user.id,
      authorName: session.user.name,
      createdAt: now,
    };

    // 시트에 추가
    await insertRow(SHEET_NAMES.IMPROVEMENT_COMMENTS, newComment);

    return NextResponse.json({
      success: true,
      data: newComment as unknown as ImprovementComment,
      message: '댓글이 등록되었습니다.',
    });
  } catch (error) {
    console.error('댓글 등록 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
