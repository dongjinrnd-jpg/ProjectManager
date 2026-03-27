/**
 * 업무일지 댓글 API Routes
 *
 * GET /api/worklogs/[id]/comments - 댓글 목록 조회 (스레드 구조)
 * POST /api/worklogs/[id]/comments - 댓글 등록
 *
 * 조회: 모든 로그인 사용자
 * 작성: engineer, admin, sysadmin
 */

import { NextResponse } from 'next/server';
import {
  findRowByColumn,
  getAllAsObjects,
  insertRow,
  query,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type {
  WorklogComment,
  CreateWorklogCommentInput,
  WorklogCommentThread,
} from '@/types/worklogComment';

// 댓글 작성 권한 확인
function canWriteComment(role: string): boolean {
  return ['engineer', 'admin', 'sysadmin'].includes(role);
}

/**
 * GET /api/worklogs/[id]/comments
 * 댓글 목록 조회 (스레드 구조)
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

    // 해당 업무일지의 댓글만 서버사이드 필터링
    const worklogComments = await query<Record<string, unknown>>(
      SHEET_NAMES.WORKLOG_COMMENTS,
      {
        filters: [{ column: 'worklogId', op: 'eq', value: id }],
        orderBy: { column: 'createdAt', ascending: true },
      }
    );

    // 부모 댓글과 답글 분리
    const parentComments = worklogComments.filter((c) => !c.parentId);
    const replies = worklogComments.filter((c) => c.parentId);

    // 스레드 구조로 그룹핑
    const threads: WorklogCommentThread[] = parentComments.map((parent) => ({
      comment: parent as unknown as WorklogComment,
      replies: replies.filter(
        (r) => r.parentId === parent.id
      ) as unknown as WorklogComment[],
    }));

    return NextResponse.json({
      success: true,
      data: threads,
      total: worklogComments.length,
    });
  } catch (error) {
    console.error('업무일지 댓글 목록 조회 오류:', error);
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
 * POST /api/worklogs/[id]/comments
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

    // 작성 권한 확인
    if (!canWriteComment(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '댓글 작성 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 업무일지 존재 확인
    const worklog = await findRowByColumn<Record<string, unknown>>(
      SHEET_NAMES.WORKLOGS,
      'id',
      id
    );

    if (!worklog) {
      return NextResponse.json(
        { success: false, error: '업무일지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 요청 본문 파싱
    const body: CreateWorklogCommentInput = await request.json();

    // 필수 필드 검증
    if (!body.content || !body.content.trim()) {
      return NextResponse.json(
        { success: false, error: '댓글 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 답글인 경우 부모 댓글 존재 확인
    if (body.parentId) {
      const parentComment = await findRowByColumn<Record<string, unknown>>(
        SHEET_NAMES.WORKLOG_COMMENTS,
        'id',
        body.parentId
      );
      if (!parentComment) {
        return NextResponse.json(
          { success: false, error: '부모 댓글을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
    }

    // 새 ID 생성
    const allComments = await getAllAsObjects<{ id: string }>(SHEET_NAMES.WORKLOG_COMMENTS);

    let maxNum = 0;
    for (const row of allComments) {
      if (row.id && row.id.startsWith('WLC-')) {
        const num = parseInt(row.id.replace('WLC-', ''), 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const commentId = `WLC-${String(maxNum + 1).padStart(5, '0')}`;

    const now = new Date().toISOString();

    // 새 댓글 데이터
    const newComment: Record<string, unknown> = {
      id: commentId,
      worklogId: id,
      authorId: session.user.id,
      authorName: session.user.name,
      parentId: body.parentId || '',
      content: body.content.trim(),
      createdAt: now,
    };

    // 시트에 추가
    await insertRow(SHEET_NAMES.WORKLOG_COMMENTS, newComment);

    return NextResponse.json({
      success: true,
      data: newComment as unknown as WorklogComment,
      message: '댓글이 등록되었습니다.',
    });
  } catch (error) {
    console.error('업무일지 댓글 등록 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
