/**
 * 회의록 상세 API Routes
 *
 * GET /api/meeting-minutes/[id] - 상세 조회
 * PUT /api/meeting-minutes/[id] - 수정
 * DELETE /api/meeting-minutes/[id] - 삭제
 *
 * 권한:
 * - GET: 모든 로그인 사용자
 * - PUT: 모든 로그인 사용자
 * - DELETE: 작성자 본인, 팀장(engineer), admin, sysadmin
 */

import { NextResponse } from 'next/server';
import {
  getAllAsObjects,
  getRows,
  getHeaders,
  updateRow,
  deleteRow,
  SHEET_NAMES,
} from '@/lib/google';
import { getSession } from '@/lib/auth';
import type {
  MeetingMinutesDetail,
  UpdateMeetingMinutesInput,
  Attendee,
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

interface SheetProject extends Record<string, unknown> {
  id: string;
  teamLeaderId: string;
}

/**
 * GET /api/meeting-minutes/[id]
 * 회의록 상세 조회
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

    // 데이터 조회
    const [meetingMinutes, users] = await Promise.all([
      getAllAsObjects<SheetMeetingMinutes>(SHEET_NAMES.MEETING_MINUTES),
      getAllAsObjects<SheetUser>(SHEET_NAMES.USERS),
    ]);

    // 사용자 맵
    const userMap = new Map(users.map(u => [u.id, u.name]));

    // 해당 회의록 찾기
    const meeting = meetingMinutes.find(m => m.id === id);
    if (!meeting) {
      return NextResponse.json(
        { success: false, error: '회의록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 참석자 JSON 파싱
    let attendees: Attendee[] = [];
    try {
      attendees = JSON.parse(meeting.attendeesJson || '[]');
    } catch {
      attendees = [];
    }

    const detail: MeetingMinutesDetail = {
      id: meeting.id,
      projectId: meeting.projectId,
      title: meeting.title,
      hostDepartment: meeting.hostDepartment,
      location: meeting.location,
      meetingDate: meeting.meetingDate,
      attendeesJson: meeting.attendeesJson,
      agenda: meeting.agenda || '',
      discussion: meeting.discussion || '',
      decisions: meeting.decisions || '',
      nextSteps: meeting.nextSteps || '',
      createdById: meeting.createdById,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
      createdByName: userMap.get(meeting.createdById) || meeting.createdById,
      attendees,
    };

    return NextResponse.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    console.error('회의록 상세 조회 오류:', error);
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
 * PUT /api/meeting-minutes/[id]
 * 회의록 수정
 */
export async function PUT(
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
    const body: UpdateMeetingMinutesInput = await request.json();

    // 회의록 조회
    const rows = await getRows(SHEET_NAMES.MEETING_MINUTES);
    const headers = await getHeaders(SHEET_NAMES.MEETING_MINUTES);

    if (rows.length <= 1) {
      return NextResponse.json(
        { success: false, error: '회의록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ID 컬럼 인덱스 찾기
    const idIndex = headers.indexOf('id');
    if (idIndex < 0) {
      return NextResponse.json(
        { success: false, error: '시트 구조 오류' },
        { status: 500 }
      );
    }

    // 해당 행 찾기 (헤더 제외)
    let rowIndex = -1;
    let existingData: Record<string, string> = {};

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIndex] === id) {
        rowIndex = i + 1; // 1-indexed
        // 기존 데이터 로드
        headers.forEach((h, idx) => {
          existingData[h] = rows[i][idx] || '';
        });
        break;
      }
    }

    if (rowIndex < 0) {
      return NextResponse.json(
        { success: false, error: '회의록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 시트 데이터 업데이트
    const now = new Date().toISOString();
    const updatedData: Record<string, string> = {
      ...existingData,
      title: body.title || existingData.title,
      hostDepartment: body.hostDepartment || existingData.hostDepartment,
      location: body.location || existingData.location,
      meetingDate: body.meetingDate || existingData.meetingDate,
      attendeesJson: body.attendees ? JSON.stringify(body.attendees) : existingData.attendeesJson,
      agenda: body.agenda !== undefined ? body.agenda : existingData.agenda,
      discussion: body.discussion !== undefined ? body.discussion : existingData.discussion,
      decisions: body.decisions !== undefined ? body.decisions : existingData.decisions,
      nextSteps: body.nextSteps !== undefined ? body.nextSteps : existingData.nextSteps,
      updatedAt: now,
    };

    const rowData = headers.map(h => updatedData[h] || '');
    await updateRow(SHEET_NAMES.MEETING_MINUTES, rowIndex, rowData);

    return NextResponse.json({
      success: true,
      data: updatedData,
    });
  } catch (error) {
    console.error('회의록 수정 오류:', error);
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
 * DELETE /api/meeting-minutes/[id]
 * 회의록 삭제
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

    // 회의록 조회
    const rows = await getRows(SHEET_NAMES.MEETING_MINUTES);
    const headers = await getHeaders(SHEET_NAMES.MEETING_MINUTES);

    if (rows.length <= 1) {
      return NextResponse.json(
        { success: false, error: '회의록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 컬럼 인덱스 찾기
    const idIndex = headers.indexOf('id');
    const createdByIdIndex = headers.indexOf('createdById');
    const projectIdIndex = headers.indexOf('projectId');

    if (idIndex < 0) {
      return NextResponse.json(
        { success: false, error: '시트 구조 오류' },
        { status: 500 }
      );
    }

    // 해당 행 찾기
    let rowIndex = -1;
    let createdById = '';
    let projectId = '';

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIndex] === id) {
        rowIndex = i + 1; // 1-indexed
        createdById = rows[i][createdByIdIndex] || '';
        projectId = rows[i][projectIdIndex] || '';
        break;
      }
    }

    if (rowIndex < 0) {
      return NextResponse.json(
        { success: false, error: '회의록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 확인: 작성자 본인, 해당 프로젝트 팀장, admin, sysadmin
    const isAuthor = createdById === session.user.id;
    const isAdmin = ['admin', 'sysadmin'].includes(session.user.role);

    // 팀장 여부 확인
    let isTeamLeader = false;
    if (projectId && session.user.role === 'engineer') {
      const projects = await getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS);
      const project = projects.find(p => p.id === projectId);
      if (project && project.teamLeaderId === session.user.id) {
        isTeamLeader = true;
      }
    }

    if (!isAuthor && !isAdmin && !isTeamLeader) {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 시트에서 행 삭제
    await deleteRow(SHEET_NAMES.MEETING_MINUTES, rowIndex);

    return NextResponse.json({
      success: true,
      message: '회의록이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('회의록 삭제 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
