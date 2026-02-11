/**
 * 개별 코멘트 API Routes
 *
 * GET /api/comments/[id] - 코멘트 상세 조회
 * DELETE /api/comments/[id] - 코멘트 삭제
 *
 * 권한:
 * - GET: 모든 로그인 사용자
 * - DELETE: 작성자 또는 admin만
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  getHeaders,
  getRows,
  deleteRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';

// 시트에서 가져온 코멘트 타입
interface SheetComment extends Record<string, unknown> {
  id: string;
  projectId: string;
  authorId: string;
  parentId: string;
  content: string;
  createdAt: string;
}

// 시트에서 가져온 사용자 타입
interface SheetUser extends Record<string, unknown> {
  id: string;
  name: string;
}

/**
 * GET /api/comments/[id]
 * 코멘트 상세 조회 (답변 포함)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 모든 코멘트 조회
    const allComments = await getAllAsObjects<SheetComment>(SHEET_NAMES.COMMENTS);

    // 해당 코멘트 찾기
    const comment = allComments.find((c) => c.id === id);

    if (!comment) {
      return NextResponse.json(
        { success: false, error: '코멘트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사용자 정보 조회
    const users = await getAllAsObjects<SheetUser>(SHEET_NAMES.USERS);
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // 답변 찾기 (이 코멘트가 부모인 경우)
    const replies = allComments
      .filter((c) => c.parentId === id)
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .map((r) => ({
        id: r.id,
        projectId: r.projectId,
        authorId: r.authorId,
        parentId: r.parentId || undefined,
        content: r.content,
        createdAt: r.createdAt,
        authorName: userMap.get(r.authorId) || r.authorId,
      }));

    return NextResponse.json({
      success: true,
      data: {
        comment: {
          id: comment.id,
          projectId: comment.projectId,
          authorId: comment.authorId,
          parentId: comment.parentId || undefined,
          content: comment.content,
          createdAt: comment.createdAt,
        },
        replies,
        authorName: userMap.get(comment.authorId) || comment.authorId,
      },
    });
  } catch (error) {
    console.error('코멘트 상세 조회 오류:', error);
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
 * DELETE /api/comments/[id]
 * 코멘트 삭제 (작성자 또는 admin만)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 인증 확인
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 헤더 및 행 가져오기
    const headers = await getHeaders(SHEET_NAMES.COMMENTS);
    const rows = await getRows(SHEET_NAMES.COMMENTS);
    const idIndex = headers.indexOf('id');
    const authorIdIndex = headers.indexOf('authorId');

    if (idIndex === -1) {
      return NextResponse.json(
        { success: false, error: '시트 구조 오류: id 컬럼을 찾을 수 없습니다.' },
        { status: 500 }
      );
    }

    // 해당 코멘트 찾기
    let foundRowIndex: number | null = null;
    let authorId: string | null = null;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][idIndex] === id) {
        foundRowIndex = i + 2; // 헤더 제외, 1-based index
        authorId = rows[i][authorIdIndex] || null;
        break;
      }
    }

    if (foundRowIndex === null) {
      return NextResponse.json(
        { success: false, error: '코멘트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 체크: 작성자이거나 admin
    const isAuthor = authorId === session.user.id;
    const isAdmin = ['admin', 'sysadmin'].includes(session.user.role);

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 답변이 있는 경우 함께 삭제
    const parentIdIndex = headers.indexOf('parentId');
    const replyRowIndices: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][parentIdIndex] === id) {
        replyRowIndices.push(i + 2);
      }
    }

    // 답변 먼저 삭제 (인덱스가 변경되지 않도록 역순으로)
    for (const rowIndex of replyRowIndices.sort((a, b) => b - a)) {
      await deleteRow(SHEET_NAMES.COMMENTS, rowIndex);
    }

    // 부모 코멘트 삭제 (답변 삭제 후 인덱스 조정)
    const adjustedRowIndex = foundRowIndex - replyRowIndices.filter((r) => r < foundRowIndex).length;
    await deleteRow(SHEET_NAMES.COMMENTS, adjustedRowIndex);

    return NextResponse.json({
      success: true,
      message: '코멘트가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('코멘트 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
