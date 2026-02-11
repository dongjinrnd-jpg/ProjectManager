/**
 * 회의록 API Routes
 *
 * GET /api/meeting-minutes - 목록 조회 (projectId 필수)
 * POST /api/meeting-minutes - 회의록 생성
 *
 * 권한:
 * - GET: 모든 로그인 사용자
 * - POST: 모든 로그인 사용자 (팀원 전체 작성 가능)
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  appendRow,
  getHeaders,
  getRows,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type {
  MeetingMinutes,
  MeetingMinutesListItem,
  CreateMeetingMinutesInput,
} from '@/types';

// 시트 데이터 타입
interface SheetMeetingMinutes extends Record<string, unknown> {
  id: string;
  projectId: string;
  title: string;
  hostDepartment: string;
  location: string;
  meetingDate: string;
  attendeesJson: string;
  agenda: string;
  discussion: string;
  decisions: string;
  nextSteps: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface SheetUser extends Record<string, unknown> {
  id: string;
  name: string;
}

/**
 * 새 회의록 ID 생성
 */
async function generateMeetingMinutesId(): Promise<string> {
  const rows = await getRows(SHEET_NAMES.MEETING_MINUTES);

  // 헤더 제외한 데이터 행 수
  const count = rows.length > 0 ? rows.length - 1 : 0;

  // MTG-001 형식으로 ID 생성
  const nextNum = count + 1;
  return `MTG-${String(nextNum).padStart(3, '0')}`;
}

/**
 * GET /api/meeting-minutes
 * 회의록 목록 조회
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

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 데이터 조회
    const [meetingMinutes, users] = await Promise.all([
      getAllAsObjects<SheetMeetingMinutes>(SHEET_NAMES.MEETING_MINUTES),
      getAllAsObjects<SheetUser>(SHEET_NAMES.USERS),
    ]);

    // 사용자 맵
    const userMap = new Map(users.map(u => [u.id, u.name]));

    // 프로젝트별 필터링
    const filtered = meetingMinutes
      .filter(m => m.projectId === projectId)
      .map(m => ({
        id: m.id,
        projectId: m.projectId,
        title: m.title,
        hostDepartment: m.hostDepartment,
        location: m.location,
        meetingDate: m.meetingDate,
        createdByName: userMap.get(m.createdById) || m.createdById,
        createdById: m.createdById,
        createdAt: m.createdAt,
      } as MeetingMinutesListItem))
      .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());

    return NextResponse.json({
      success: true,
      data: filtered,
      total: filtered.length,
    });
  } catch (error) {
    console.error('회의록 목록 조회 오류:', error);
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
 * POST /api/meeting-minutes
 * 회의록 생성
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

    // 요청 바디 파싱
    const body: CreateMeetingMinutesInput = await request.json();

    // 필수 필드 검증
    if (!body.projectId || !body.title || !body.meetingDate) {
      return NextResponse.json(
        { success: false, error: '필수 항목을 입력해주세요. (프로젝트, 회의명, 회의일시)' },
        { status: 400 }
      );
    }

    // 새 ID 생성
    const id = await generateMeetingMinutesId();

    // 현재 시간
    const now = new Date().toISOString();

    // 시트에 저장할 데이터
    const meetingMinutes: MeetingMinutes = {
      id,
      projectId: body.projectId,
      title: body.title,
      hostDepartment: body.hostDepartment || '',
      location: body.location || '',
      meetingDate: body.meetingDate,
      attendeesJson: JSON.stringify(body.attendees || []),
      agenda: body.agenda || '',
      discussion: body.discussion || '',
      decisions: body.decisions || '',
      nextSteps: body.nextSteps || '',
      createdById: session.user.id,
      createdAt: now,
      updatedAt: now,
    };

    // 헤더 조회
    const headers = await getHeaders(SHEET_NAMES.MEETING_MINUTES);

    // 기본 헤더
    const defaultHeaders = [
      'id', 'projectId', 'title', 'hostDepartment', 'location',
      'meetingDate', 'attendeesJson', 'agenda', 'discussion',
      'decisions', 'nextSteps', 'createdById', 'createdAt', 'updatedAt'
    ];

    // 헤더가 없으면 생성
    if (headers.length === 0) {
      await appendRow(SHEET_NAMES.MEETING_MINUTES, defaultHeaders);
    }

    // 데이터를 배열로 변환하여 저장
    const currentHeaders = headers.length > 0 ? headers : defaultHeaders;

    const rowData = currentHeaders.map(h => {
      const value = meetingMinutes[h as keyof MeetingMinutes];
      return value !== undefined ? String(value) : '';
    });

    await appendRow(SHEET_NAMES.MEETING_MINUTES, rowData);

    return NextResponse.json({
      success: true,
      data: meetingMinutes,
    });
  } catch (error) {
    console.error('회의록 생성 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
