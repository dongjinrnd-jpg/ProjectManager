/**
 * 경영진 코멘트 API Routes
 *
 * GET /api/comments - 프로젝트별 코멘트 목록 조회
 * POST /api/comments - 코멘트 생성
 *
 * 권한:
 * - GET: 모든 로그인 사용자
 * - POST (parentId 없음): executive, admin만 (경영진 코멘트)
 * - POST (parentId 있음): engineer, admin만 (팀장 답변)
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  insertRow,
  query,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { Comment, CreateCommentInput, CommentThread } from '@/types';

/**
 * 새 코멘트 ID 생성
 */
async function generateCommentId(): Promise<string> {
  const allComments = await getAllAsObjects<{ id: string }>(SHEET_NAMES.COMMENTS);

  // 최대 번호 계산
  const prefix = 'CMT-';
  let maxNum = 0;

  for (const row of allComments) {
    if (row.id && row.id.startsWith(prefix)) {
      const num = parseInt(row.id.replace(prefix, ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * GET /api/comments
 * 프로젝트별 코멘트 목록 조회 (스레드 형태)
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

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 해당 프로젝트의 코멘트 서버사이드 필터링
    const [projectComments, users] = await Promise.all([
      query<Record<string, unknown>>(SHEET_NAMES.COMMENTS, {
        filters: [{ column: 'projectId', op: 'eq', value: projectId }],
        orderBy: { column: 'createdAt', ascending: true },
      }),
      getAllAsObjects<Record<string, unknown>>(SHEET_NAMES.USERS),
    ]);
    const userMap = new Map(users.map((u) => [u.id as string, u.name as string]));

    // 스레드 구성: 부모 코멘트와 답변 분리
    const parentComments = projectComments.filter((c) => !c.parentId);
    const replyComments = projectComments.filter((c) => c.parentId);

    // 스레드 형태로 구성
    const threads: CommentThread[] = parentComments.map((parent) => {
      const replies = replyComments
        .filter((r) => r.parentId === parent.id)
        .sort(
          (a, b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime()
        );

      return {
        comment: {
          id: parent.id as string,
          projectId: parent.projectId as string,
          authorId: parent.authorId as string,
          parentId: (parent.parentId as string) || undefined,
          content: parent.content as string,
          createdAt: parent.createdAt as string,
        },
        replies: replies.map((r) => ({
          id: r.id as string,
          projectId: r.projectId as string,
          authorId: r.authorId as string,
          parentId: (r.parentId as string) || undefined,
          content: r.content as string,
          createdAt: r.createdAt as string,
        })),
        authorName: userMap.get(parent.authorId as string) || (parent.authorId as string),
      };
    });

    // 최신순 정렬 (최근 코멘트가 위에)
    threads.sort(
      (a, b) =>
        new Date(b.comment.createdAt).getTime() -
        new Date(a.comment.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      data: threads,
      total: threads.length,
    });
  } catch (error) {
    console.error('코멘트 목록 조회 오류:', error);
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
 * POST /api/comments
 * 코멘트 생성
 */
export async function POST(request: Request) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 요청 본문 파싱
    const body: CreateCommentInput = await request.json();

    // 필수 필드 검증
    if (!body.projectId || !body.content) {
      return NextResponse.json(
        { success: false, error: 'projectId와 content가 필요합니다.' },
        { status: 400 }
      );
    }

    const userRole = session.user.role;

    // 권한 체크
    if (body.parentId) {
      // 답변(parentId 있음): engineer, admin, manager만 가능 (팀장 답변)
      if (!['engineer', 'admin', 'manager'].includes(userRole)) {
        return NextResponse.json(
          { success: false, error: '답변 권한이 없습니다.' },
          { status: 403 }
        );
      }

      // 부모 코멘트 존재 확인
      const parentResults = await query<Record<string, unknown>>(SHEET_NAMES.COMMENTS, {
        filters: [{ column: 'id', op: 'eq', value: body.parentId }],
        limit: 1,
      });
      const parentComment = parentResults[0];
      if (!parentComment) {
        return NextResponse.json(
          { success: false, error: '부모 코멘트를 찾을 수 없습니다.' },
          { status: 400 }
        );
      }
    } else {
      // 경영진 코멘트(parentId 없음): executive, admin, sysadmin만 가능
      if (!['executive', 'admin', 'sysadmin'].includes(userRole)) {
        return NextResponse.json(
          { success: false, error: '코멘트 작성 권한이 없습니다.' },
          { status: 403 }
        );
      }
    }

    // 새 ID 생성
    const commentId = await generateCommentId();

    // 현재 시간
    const now = new Date().toISOString();

    // 새 코멘트 데이터
    const newComment: Record<string, unknown> = {
      id: commentId,
      projectId: body.projectId,
      authorId: session.user.id,
      parentId: body.parentId || '',
      content: body.content,
      createdAt: now,
    };

    // 시트에 추가
    await insertRow(SHEET_NAMES.COMMENTS, newComment);

    // 응답 데이터 구성
    const responseData: Comment = {
      id: commentId,
      projectId: body.projectId,
      authorId: session.user.id,
      parentId: body.parentId,
      content: body.content,
      createdAt: now,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: body.parentId ? '답변이 등록되었습니다.' : '코멘트가 등록되었습니다.',
    });
  } catch (error) {
    console.error('코멘트 생성 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
