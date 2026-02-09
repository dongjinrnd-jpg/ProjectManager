/**
 * 주간 보고 상세 API Routes
 *
 * GET /api/weekly-reports/[id] - 주간 보고 상세 조회
 * PUT /api/weekly-reports/[id] - 주간 보고 수정
 * DELETE /api/weekly-reports/[id] - 주간 보고 삭제
 *
 * 권한:
 * - 조회: 모든 로그인 사용자
 * - 수정: 작성자 본인 또는 admin
 * - 삭제: admin만
 */

import { NextResponse } from 'next/server';
import {
  findRowByColumn,
  updateRow,
  getHeaders,
  objectToRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { WeeklyReport, UpdateWeeklyReportInput } from '@/types';

// 시트에서 가져온 주간 보고 타입
interface SheetWeeklyReport extends Record<string, unknown> {
  id: string;
  year: number;
  month: number;
  week: number;
  weekStart: string;
  weekEnd: string;
  categoryId: string;
  customer: string;
  item: string;
  projectId: string;
  content: string;
  order: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  isIncluded?: boolean;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/weekly-reports/[id]
 * 주간 보고 상세 조회
 */
export async function GET(request: Request, { params }: RouteParams) {
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

    // 주간 보고 조회
    const result = await findRowByColumn<SheetWeeklyReport>(
      SHEET_NAMES.WEEKLY_REPORTS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '주간 보고를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data as unknown as WeeklyReport,
    });
  } catch (error) {
    console.error('주간 보고 조회 오류:', error);
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
 * PUT /api/weekly-reports/[id]
 * 주간 보고 수정
 */
export async function PUT(request: Request, { params }: RouteParams) {
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

    // 주간 보고 조회
    const result = await findRowByColumn<SheetWeeklyReport>(
      SHEET_NAMES.WEEKLY_REPORTS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '주간 보고를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { rowIndex, data: report } = result;

    // 권한 확인 (작성자 본인 또는 admin)
    const userRole = session.user.role;
    if (report.createdById !== session.user.id && userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: '수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body: UpdateWeeklyReportInput = await request.json();

    // 현재 시간
    const now = new Date().toISOString();

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.WEEKLY_REPORTS);

    // 업데이트할 데이터
    const updatedReport: Record<string, unknown> = {
      ...report,
      categoryId: body.categoryId ?? report.categoryId,
      customer: body.customer ?? report.customer,
      item: body.item ?? report.item,
      projectId: body.projectId ?? report.projectId,
      content: body.content ?? report.content,
      order: body.order ?? report.order,
      isDeleted: body.isDeleted !== undefined ? body.isDeleted : report.isDeleted,
      isIncluded: body.isIncluded !== undefined ? body.isIncluded : report.isIncluded,
      updatedAt: now,
    };

    // 행 데이터 생성
    const rowValues = objectToRow(headers, updatedReport);

    // 시트 업데이트
    await updateRow(SHEET_NAMES.WEEKLY_REPORTS, rowIndex, rowValues);

    return NextResponse.json({
      success: true,
      data: updatedReport as unknown as WeeklyReport,
      message: '주간 보고가 수정되었습니다.',
    });
  } catch (error) {
    console.error('주간 보고 수정 오류:', error);
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
 * DELETE /api/weekly-reports/[id]
 * 주간 보고 삭제 (소프트 삭제 - isDeleted 플래그 설정)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
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

    // 권한 확인 (admin만 삭제 가능)
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 주간 보고 조회
    const result = await findRowByColumn<SheetWeeklyReport>(
      SHEET_NAMES.WEEKLY_REPORTS,
      'id',
      id
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: '주간 보고를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { rowIndex, data: report } = result;

    // 소프트 삭제 - isDeleted 플래그 설정
    const headers = await getHeaders(SHEET_NAMES.WEEKLY_REPORTS);
    const updatedReport: Record<string, unknown> = {
      ...report,
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    };

    const rowValues = objectToRow(headers, updatedReport);
    await updateRow(SHEET_NAMES.WEEKLY_REPORTS, rowIndex, rowValues);

    return NextResponse.json({
      success: true,
      message: '주간 보고가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('주간 보고 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}