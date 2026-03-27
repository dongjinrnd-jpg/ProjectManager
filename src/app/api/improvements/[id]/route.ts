/**
 * 개선요청 상세 API Routes
 *
 * GET /api/improvements/[id] - 상세 조회
 * PUT /api/improvements/[id] - 수정
 * DELETE /api/improvements/[id] - 삭제
 *
 * 권한:
 * - 조회: engineer, admin, sysadmin
 * - 수정/삭제: 작성자 또는 sysadmin
 */

import { NextResponse } from 'next/server';
import {
  findRowByColumn,
  getAllAsObjects,
  updateById,
  deleteById,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type {
  Improvement,
  ImprovementDetail,
  ImprovementHistory,
  ImprovementComment,
  UpdateImprovementInput,
  ImprovementType,
  ImprovementStatus,
  ImprovementPriority,
  RelatedMenu,
} from '@/types/improvement';

// 허용된 역할 확인
function hasAccess(role: string): boolean {
  return ['engineer', 'admin', 'sysadmin'].includes(role);
}

// 수정/삭제 권한 확인
function canModify(userId: string, authorId: string, role: string): boolean {
  return userId === authorId || role === 'sysadmin';
}

/**
 * GET /api/improvements/[id]
 * 개선요청 상세 조회
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

    // 개선요청 조회
    const result = await findRowByColumn<Improvement & Record<string, unknown>>(
      SHEET_NAMES.IMPROVEMENTS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '개선요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const improvement = result.data as Improvement;

    // 처리 이력 조회
    const allHistories = await getAllAsObjects<ImprovementHistory & Record<string, unknown>>(
      SHEET_NAMES.IMPROVEMENT_HISTORIES
    );
    const histories: ImprovementHistory[] = allHistories
      .filter((h) => h.improvementId === id)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

    // 댓글 조회
    const allComments = await getAllAsObjects<ImprovementComment & Record<string, unknown>>(
      SHEET_NAMES.IMPROVEMENT_COMMENTS
    );
    const comments: ImprovementComment[] = allComments
      .filter((c) => c.improvementId === id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // 상세 정보 조합
    const detail: ImprovementDetail = {
      ...improvement,
      histories,
      comments,
    };

    return NextResponse.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    console.error('개선요청 상세 조회 오류:', error);
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
 * PUT /api/improvements/[id]
 * 개선요청 수정
 */
export async function PUT(
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

    // 개선요청 조회
    const result = await findRowByColumn<Improvement & Record<string, unknown>>(
      SHEET_NAMES.IMPROVEMENTS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '개선요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 수정 권한 확인
    if (!canModify(session.user.id, result.data.authorId, session.user.role)) {
      return NextResponse.json(
        { success: false, error: '수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body: UpdateImprovementInput = await request.json();

    // 업데이트할 데이터
    const updatedImprovement: Record<string, unknown> = {
      ...result.data,
      title: body.title ?? result.data.title,
      type: body.type ?? result.data.type,
      content: body.content ?? result.data.content,
      relatedMenu: body.relatedMenu ?? result.data.relatedMenu,
      priority: body.priority ?? result.data.priority,
      reproductionSteps: body.reproductionSteps ?? result.data.reproductionSteps,
      screenshotUrl: body.screenshotUrl ?? result.data.screenshotUrl,
      updatedAt: new Date().toISOString(),
    };

    // 행 업데이트
    await updateById(SHEET_NAMES.IMPROVEMENTS, id, updatedImprovement);

    return NextResponse.json({
      success: true,
      data: updatedImprovement as unknown as Improvement,
      message: '개선요청이 수정되었습니다.',
    });
  } catch (error) {
    console.error('개선요청 수정 오류:', error);
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
 * DELETE /api/improvements/[id]
 * 개선요청 삭제
 */
export async function DELETE(
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

    // 개선요청 조회
    const result = await findRowByColumn<Improvement & Record<string, unknown>>(
      SHEET_NAMES.IMPROVEMENTS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '개선요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 삭제 권한 확인
    if (!canModify(session.user.id, result.data.authorId, session.user.role)) {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 행 삭제
    await deleteById(SHEET_NAMES.IMPROVEMENTS, id);

    return NextResponse.json({
      success: true,
      message: '개선요청이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('개선요청 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
