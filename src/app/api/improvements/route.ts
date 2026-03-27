/**
 * 개선요청 API Routes
 *
 * GET /api/improvements - 목록 조회
 * POST /api/improvements - 등록
 *
 * 권한: engineer, admin, sysadmin만 접근 가능
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  insertRow,
  query,
  SHEET_NAMES,
} from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type {
  Improvement,
  ImprovementListItem,
  CreateImprovementInput,
  ImprovementType,
  ImprovementStatus,
  ImprovementPriority,
  RelatedMenu,
} from '@/types/improvement';

// 허용된 역할 확인
function hasAccess(role: string): boolean {
  return ['engineer', 'admin', 'sysadmin'].includes(role);
}

/**
 * 새 개선요청 ID 생성
 * 형식: IMP-001, IMP-002, ...
 */
async function generateImprovementId(): Promise<string> {
  const rows = await getAllAsObjects<{ id: string }>(SHEET_NAMES.IMPROVEMENTS);

  let maxNum = 0;
  for (const row of rows) {
    if (row.id && row.id.startsWith('IMP-')) {
      const num = parseInt(row.id.replace('IMP-', ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `IMP-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * GET /api/improvements
 * 개선요청 목록 조회
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

    // 권한 확인
    if (!hasAccess(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ImprovementStatus | null;
    const type = searchParams.get('type') as ImprovementType | null;
    const priority = searchParams.get('priority') as ImprovementPriority | null;
    const keyword = searchParams.get('keyword') || '';

    // 서버사이드 필터링으로 조회
    const filters: Array<{ column: string; op: 'eq'; value: unknown }> = [];
    if (status) filters.push({ column: 'status', op: 'eq', value: status });
    if (type) filters.push({ column: 'type', op: 'eq', value: type });
    if (priority) filters.push({ column: 'priority', op: 'eq', value: priority });

    // 키워드 검색: OR 조건 (title, content)
    const orFilter = keyword
      ? `title.ilike.%${keyword}%,content.ilike.%${keyword}%`
      : undefined;

    const improvements = await query<Improvement & Record<string, unknown>>(
      SHEET_NAMES.IMPROVEMENTS,
      {
        filters,
        or: orFilter,
        orderBy: { column: 'createdAt', ascending: false },
      }
    );

    // 목록용 간략 정보로 변환
    const listItems: ImprovementListItem[] = improvements.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      status: item.status,
      priority: item.priority,
      relatedMenu: item.relatedMenu,
      authorId: item.authorId,
      authorName: item.authorName,
      createdAt: item.createdAt,
      dueDate: item.dueDate,
    }));

    return NextResponse.json({
      success: true,
      data: listItems,
      total: listItems.length,
    });
  } catch (error) {
    console.error('개선요청 목록 조회 오류:', error);
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
 * POST /api/improvements
 * 개선요청 등록
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

    // 권한 확인
    if (!hasAccess(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body: CreateImprovementInput = await request.json();

    // 필수 필드 검증
    if (!body.title || !body.type || !body.content) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다. (title, type, content)' },
        { status: 400 }
      );
    }

    // 새 ID 생성
    const improvementId = await generateImprovementId();

    // 현재 시간
    const now = new Date().toISOString();

    // 새 개선요청 데이터
    const newImprovement: Record<string, unknown> = {
      id: improvementId,
      title: body.title,
      type: body.type,
      status: 'submitted', // 초기 상태: 접수
      priority: body.priority || 'normal', // 기본값: 보통
      content: body.content,
      relatedMenu: body.relatedMenu || 'other',
      reproductionSteps: body.reproductionSteps || '',
      screenshotUrl: body.screenshotUrl || '',
      authorId: session.user.id,
      authorName: session.user.name,
      createdAt: now,
      updatedAt: now,
      dueDate: '',
      completedAt: '',
    };

    // 시트에 추가
    await insertRow(SHEET_NAMES.IMPROVEMENTS, newImprovement);

    // 초기 이력 추가 (접수)
    await addHistory(improvementId, 'submitted', '요청 등록', session.user.id, session.user.name || '');

    return NextResponse.json({
      success: true,
      data: newImprovement as unknown as Improvement,
      message: '개선요청이 등록되었습니다.',
    });
  } catch (error) {
    console.error('개선요청 등록 오류:', error);
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
 * 처리 이력 추가
 */
async function addHistory(
  improvementId: string,
  status: ImprovementStatus,
  memo: string,
  changedBy: string,
  changedByName: string
): Promise<void> {
  const allHistories = await getAllAsObjects<{ id: string }>(SHEET_NAMES.IMPROVEMENT_HISTORIES);

  // 새 ID 생성
  let maxNum = 0;
  for (const row of allHistories) {
    if (row.id && row.id.startsWith('IMPH-')) {
      const num = parseInt(row.id.replace('IMPH-', ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const historyId = `IMPH-${String(maxNum + 1).padStart(5, '0')}`;

  const now = new Date().toISOString();

  const historyData: Record<string, unknown> = {
    id: historyId,
    improvementId,
    status,
    memo,
    changedBy,
    changedByName,
    changedAt: now,
  };

  await insertRow(SHEET_NAMES.IMPROVEMENT_HISTORIES, historyData);
}
