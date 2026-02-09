/**
 * 주간 보고 공지사항 API Routes
 *
 * GET /api/weekly-report-notices - 공지사항 조회
 * POST /api/weekly-report-notices - 공지사항 생성/수정
 *
 * 권한:
 * - 조회: 모든 로그인 사용자
 * - 생성/수정: admin만
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  appendRow,
  findRowByColumn,
  updateRow,
  getHeaders,
  objectToRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { WeeklyReportNotice } from '@/types';

// 시트에서 가져온 공지사항 타입
interface SheetWeeklyReportNotice extends Record<string, unknown> {
  id: string;
  year: number;
  month: number;
  week: number;
  content: string;
  createdById: string;
  createdAt: string;
}

/**
 * GET /api/weekly-report-notices
 * 주차별 공지사항 조회
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

    if (!year || !month || !week) {
      return NextResponse.json(
        { success: false, error: '연도, 월, 주차가 필요합니다.' },
        { status: 400 }
      );
    }

    // 해당 주차 공지사항 조회
    const allNotices = await getAllAsObjects<SheetWeeklyReportNotice>(
      SHEET_NAMES.WEEKLY_REPORT_NOTICES
    );

    const notice = allNotices.find(
      (n) =>
        String(n.year) === year &&
        String(n.month) === month &&
        String(n.week) === week
    );

    return NextResponse.json({
      success: true,
      data: notice || null,
    });
  } catch (error) {
    console.error('공지사항 조회 오류:', error);
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
 * POST /api/weekly-report-notices
 * 공지사항 생성/수정 (upsert)
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

    // 권한 확인 (admin만)
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '공지사항 편집 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body: {
      year: number;
      month: number;
      week: number;
      content: string;
    } = await request.json();

    if (!body.year || !body.month || !body.week) {
      return NextResponse.json(
        { success: false, error: '연도, 월, 주차가 필요합니다.' },
        { status: 400 }
      );
    }

    const noticeId = `WRN-${body.year}-${String(body.month).padStart(2, '0')}-${body.week}`;
    const now = new Date().toISOString();
    const headers = await getHeaders(SHEET_NAMES.WEEKLY_REPORT_NOTICES);

    // 기존 공지사항 확인
    const existing = await findRowByColumn<SheetWeeklyReportNotice>(
      SHEET_NAMES.WEEKLY_REPORT_NOTICES,
      'id',
      noticeId
    );

    if (existing) {
      // 수정
      const updatedNotice: Record<string, unknown> = {
        ...existing.data,
        content: body.content,
        createdById: session.user.id,
        createdAt: now,
      };

      const rowValues = objectToRow(headers, updatedNotice);
      await updateRow(SHEET_NAMES.WEEKLY_REPORT_NOTICES, existing.rowIndex, rowValues);

      return NextResponse.json({
        success: true,
        data: updatedNotice as unknown as WeeklyReportNotice,
        message: '공지사항이 수정되었습니다.',
      });
    } else {
      // 생성
      const newNotice: Record<string, unknown> = {
        id: noticeId,
        year: body.year,
        month: body.month,
        week: body.week,
        content: body.content,
        createdById: session.user.id,
        createdAt: now,
      };

      const rowValues = objectToRow(headers, newNotice);
      await appendRow(SHEET_NAMES.WEEKLY_REPORT_NOTICES, rowValues);

      return NextResponse.json({
        success: true,
        data: newNotice as unknown as WeeklyReportNotice,
        message: '공지사항이 등록되었습니다.',
      });
    }
  } catch (error) {
    console.error('공지사항 저장 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}