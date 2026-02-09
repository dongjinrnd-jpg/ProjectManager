/**
 * 주간 보고 API Routes
 *
 * GET /api/weekly-reports - 주간 보고 목록 조회
 * POST /api/weekly-reports - 주간 보고 생성
 *
 * 권한:
 * - 조회: 모든 로그인 사용자
 * - 생성: engineer, admin (팀장 또는 관리자)
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  appendRow,
  getHeaders,
  getRows,
  objectToRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { WeeklyReport, CreateWeeklyReportInput } from '@/types';

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

/**
 * 새 주간 보고 ID 생성
 * 형식: WR-YYYY-MM-W-NNN
 */
async function generateWeeklyReportId(
  year: number,
  month: number,
  week: number
): Promise<string> {
  const prefix = `WR-${year}-${String(month).padStart(2, '0')}-${week}-`;
  const rows = await getRows(SHEET_NAMES.WEEKLY_REPORTS);

  let maxNum = 0;
  for (const row of rows) {
    if (row[0] && row[0].startsWith(prefix)) {
      const num = parseInt(row[0].replace(prefix, ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * 해당 주차의 다음 순서 번호 계산
 */
async function getNextOrder(year: number, month: number, week: number): Promise<number> {
  const allReports = await getAllAsObjects<SheetWeeklyReport>(SHEET_NAMES.WEEKLY_REPORTS);

  // Google Sheets에서 가져온 값은 문자열이므로 문자열로 비교
  const weekReports = allReports.filter(
    (r) =>
      String(r.year) === String(year) &&
      String(r.month) === String(month) &&
      String(r.week) === String(week)
  );

  if (weekReports.length === 0) return 1;

  const maxOrder = Math.max(...weekReports.map((r) => Number(r.order) || 0));
  return maxOrder + 1;
}

/**
 * GET /api/weekly-reports
 * 주간 보고 목록 조회
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
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const week = searchParams.get('week');
    const categoryId = searchParams.get('categoryId');
    const projectId = searchParams.get('projectId');
    const onlyIncluded = searchParams.get('onlyIncluded') === 'true';

    // 모든 주간 보고 조회
    const allReports = await getAllAsObjects<SheetWeeklyReport>(SHEET_NAMES.WEEKLY_REPORTS);

    // 필터링 (Google Sheets에서 가져온 값은 문자열이므로 문자열로 비교)
    let reports = allReports.filter((report) => {
      // 제출용만 보기 (미리보기용)
      if (onlyIncluded) {
        const isIncluded = String(report.isIncluded).toLowerCase() !== 'false';
        if (!isIncluded) {
          return false;
        }
      }

      // 프로젝트 ID 필터
      if (projectId && report.projectId !== projectId) {
        return false;
      }

      // 연도 필터
      if (year && String(report.year) !== year) {
        return false;
      }

      // 월 필터
      if (month && String(report.month) !== month) {
        return false;
      }

      // 주차 필터
      if (week && String(report.week) !== week) {
        return false;
      }

      // 구분 필터
      if (categoryId && report.categoryId !== categoryId) {
        return false;
      }

      return true;
    });

    // order 기준 정렬 (오름차순)
    reports.sort((a, b) => (a.order || 0) - (b.order || 0));

    return NextResponse.json({
      success: true,
      data: reports,
      total: reports.length,
    });
  } catch (error) {
    console.error('주간 보고 목록 조회 오류:', error);
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
 * POST /api/weekly-reports
 * 주간 보고 생성
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

    // 권한 확인 (engineer, admin만 생성 가능)
    const userRole = session.user.role;
    if (userRole !== 'engineer' && userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: '주간 보고 등록 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body: CreateWeeklyReportInput = await request.json();

    // 필수 필드 검증
    if (
      !body.year ||
      !body.month ||
      !body.week ||
      !body.weekStart ||
      !body.weekEnd ||
      !body.categoryId ||
      !body.customer ||
      !body.item ||
      !body.content
    ) {
      return NextResponse.json(
        {
          success: false,
          error: '필수 필드가 누락되었습니다.',
        },
        { status: 400 }
      );
    }

    // 새 ID 생성
    const reportId = await generateWeeklyReportId(body.year, body.month, body.week);

    // 다음 순서 번호
    const order = await getNextOrder(body.year, body.month, body.week);

    // 현재 시간
    const now = new Date().toISOString();

    // 헤더 가져오기
    const headers = await getHeaders(SHEET_NAMES.WEEKLY_REPORTS);

    // 새 주간 보고 데이터 (isIncluded 기본값: true)
    const newReport: Record<string, unknown> = {
      id: reportId,
      year: body.year,
      month: body.month,
      week: body.week,
      weekStart: body.weekStart,
      weekEnd: body.weekEnd,
      categoryId: body.categoryId,
      customer: body.customer,
      item: body.item,
      projectId: body.projectId || '',
      content: body.content,
      order: order,
      createdById: session.user.id,
      createdAt: now,
      updatedAt: now,
      isIncluded: true,
    };

    // 행 데이터 생성
    const rowValues = objectToRow(headers, newReport);

    // 시트에 추가
    await appendRow(SHEET_NAMES.WEEKLY_REPORTS, rowValues);

    return NextResponse.json({
      success: true,
      data: newReport as unknown as WeeklyReport,
      message: '주간 보고가 등록되었습니다.',
    });
  } catch (error) {
    console.error('주간 보고 생성 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}