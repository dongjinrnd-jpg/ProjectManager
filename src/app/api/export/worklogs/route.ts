/**
 * 업무일지 목록 Excel 다운로드 API
 *
 * GET /api/export/worklogs
 *
 * 쿼리 파라미터:
 * - startDate: 시작일
 * - endDate: 종료일
 * - projectId: 프로젝트 ID
 * - assigneeId: 담당자 ID
 * - stage: 단계
 * - keyword: 키워드 검색
 *
 * 권한: engineer 이상
 */

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAllAsObjects, SHEET_NAMES } from '@/lib/google';
import { getSession } from '@/lib/auth';
import type { ProjectStage, UserRole } from '@/types';

interface SheetWorkLog extends Record<string, unknown> {
  id: string;
  date: string;
  projectId: string;
  item: string;
  customer: string;
  stage: ProjectStage;
  assigneeId: string;
  participants: string;
  plan: string;
  content: string;
  issue: string;
  issueStatus: string;
  scheduleId: string;
  createdAt: string;
  updatedAt: string;
}

interface SheetUser extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  role: string;
  division: string;
  isActive: string;
}

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

    // 권한 확인 (user 제외, engineer 이상 또는 executive)
    const role = session.user.role as UserRole;
    if (role === 'user') {
      return NextResponse.json(
        { success: false, error: '업무일지 다운로드 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const projectId = searchParams.get('projectId') || '';
    const assigneeId = searchParams.get('assigneeId') || '';
    const stage = searchParams.get('stage') as ProjectStage | null;
    const keyword = searchParams.get('keyword') || '';

    // 데이터 조회
    const [allWorkLogs, allUsers] = await Promise.all([
      getAllAsObjects<SheetWorkLog>(SHEET_NAMES.WORKLOGS),
      getAllAsObjects<SheetUser>(SHEET_NAMES.USERS),
    ]);

    // 사용자 ID -> 이름 매핑
    const userMap = new Map(allUsers.map(u => [u.id, u.name]));

    // 필터링
    let worklogs = allWorkLogs.filter((log) => {
      // 시작일 필터
      if (startDate && log.date < startDate) {
        return false;
      }

      // 종료일 필터
      if (endDate && log.date > endDate) {
        return false;
      }

      // 프로젝트 필터
      if (projectId && log.projectId !== projectId) {
        return false;
      }

      // 담당자 필터
      if (assigneeId && log.assigneeId !== assigneeId) {
        return false;
      }

      // 단계 필터
      if (stage && log.stage !== stage) {
        return false;
      }

      // 키워드 검색 (내용, 계획, 이슈)
      if (keyword) {
        const keywordLower = keyword.toLowerCase();
        const contentMatch = log.content?.toLowerCase().includes(keywordLower);
        const planMatch = log.plan?.toLowerCase().includes(keywordLower);
        const issueMatch = log.issue?.toLowerCase().includes(keywordLower);
        if (!contentMatch && !planMatch && !issueMatch) {
          return false;
        }
      }

      return true;
    });

    // 날짜 역순 정렬
    worklogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Excel 데이터 생성
    const excelData = worklogs.map((log, index) => ({
      'No': index + 1,
      '날짜': log.date,
      'ITEM': log.item,
      '고객사': log.customer,
      '단계': log.stage,
      '담당자': userMap.get(log.assigneeId) || log.assigneeId,
      '참여자': log.participants
        ? log.participants.split(',').map(id => userMap.get(id.trim()) || id.trim()).join(', ')
        : '',
      '계획': log.plan || '',
      '업무내용': log.content,
      '이슈사항': log.issue || '',
      '이슈상태': log.issueStatus === 'resolved' ? '해결됨' : log.issue ? '미해결' : '',
    }));

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 12 },  // 날짜
      { wch: 20 },  // ITEM
      { wch: 15 },  // 고객사
      { wch: 10 },  // 단계
      { wch: 10 },  // 담당자
      { wch: 20 },  // 참여자
      { wch: 40 },  // 계획
      { wch: 50 },  // 업무내용
      { wch: 40 },  // 이슈사항
      { wch: 8 },   // 이슈상태
    ];

    XLSX.utils.book_append_sheet(wb, ws, '업무일지');

    // Excel 파일 생성
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 생성 (업무일지_YYYYMMDD.xlsx)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `업무일지_${today}.xlsx`;

    // 응답 반환
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('업무일지 Excel 다운로드 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
