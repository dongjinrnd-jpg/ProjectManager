/**
 * 일정 데이터 Excel 다운로드 API
 *
 * GET /api/export/schedules
 *
 * 쿼리 파라미터:
 * - projectId: 특정 프로젝트 ID (없으면 전체)
 * - type: 'gantt' (전체 간트차트) | 'detail' (세부추진항목, 기본값)
 * - favorites: true면 즐겨찾기 프로젝트만 (gantt 타입에서만)
 * - status: 프로젝트 상태 필터 (gantt 타입에서만)
 * - division: 소속 필터 (gantt 타입에서만)
 *
 * 권한: 모든 로그인 사용자
 */

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';
import { getAllAsObjects, SHEET_NAMES } from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { ProjectStatus, ScheduleStatus } from '@/types';

interface SheetProject extends Record<string, unknown> {
  id: string;
  status: ProjectStatus;
  customer: string;
  division: string;
  category: string;
  model: string;
  item: string;
  partNo: string;
  teamLeaderId: string;
  teamMembers: string;
  currentStage: string;
  stages: string;
  scheduleStart: string;
  scheduleEnd: string;
  createdAt: string;
  updatedAt: string;
}

interface SheetSchedule extends Record<string, unknown> {
  id: string;
  projectId: string;
  stage: string;
  taskName: string;
  category: string;
  responsibility: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  status: ScheduleStatus;
  note: string;
  order: string;
}

interface SheetUser extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  role: string;
  division: string;
  isActive: string;
}

interface SheetFavorite extends Record<string, unknown> {
  id: string;
  userId: string;
  projectId: string;
  createdAt: string;
}

// 상태 한글 변환
function getStatusLabel(status: ScheduleStatus): string {
  const labels: Record<ScheduleStatus, string> = {
    planned: '예정',
    in_progress: '진행중',
    completed: '완료',
    delayed: '지연',
  };
  return labels[status] || status;
}

// 업무 구분 한글 변환
function getResponsibilityLabel(responsibility: string): string {
  const labels: Record<string, string> = {
    lead: '주관',
    support: '협조',
  };
  return labels[responsibility] || responsibility || '';
}

// 월단위 셀 간트 색상 (UI와 일치)
const MONTH_GANTT_COLORS = {
  planned: '93C5FD',     // blue-300 (계획)
  in_progress: 'F97316', // orange (진행중)
  completed: '10B981',   // green (완료)
  delayed: 'EF4444',     // red (지연)
  project: '93C5FD',     // 프로젝트 대일정용 (계획색과 동일)
};

const BORDER_THIN = { style: 'thin' as const, color: { rgb: '595959' } };
const ALL_BORDERS = {
  top: BORDER_THIN,
  bottom: BORDER_THIN,
  left: BORDER_THIN,
  right: BORDER_THIN,
};

interface MonthKey {
  key: string;        // 'YYYY-MM'
  label: string;      // 'YY.MM'
  start: Date;
  end: Date;
  weeks: WeekKey[];   // 5주 (1주~5주)
}

interface WeekKey {
  label: string;      // '1주' ~ '5주'
  start: Date;
  end: Date;
}

const WEEKS_PER_MONTH = 5;

// 한 달을 5주로 분할 (1주=1~7일, 2주=8~14일, 3주=15~21일, 4주=22~28일, 5주=29~말일)
function buildWeeksOfMonth(year: number, month: number): WeekKey[] {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const weeks: WeekKey[] = [];
  for (let w = 0; w < WEEKS_PER_MONTH; w++) {
    const startDay = w * 7 + 1;
    const endDay = w === WEEKS_PER_MONTH - 1 ? lastDay : Math.min((w + 1) * 7, lastDay);
    if (startDay > lastDay) {
      // 해당 주가 존재하지 않는 달(예: 2월 5주차) — 빈 범위
      weeks.push({
        label: `${w + 1}주`,
        start: new Date(year, month, lastDay),
        end: new Date(year, month, lastDay - 1), // 빈 범위 (시작 > 종료)
      });
    } else {
      weeks.push({
        label: `${w + 1}주`,
        start: new Date(year, month, startDay),
        end: new Date(year, month, endDay),
      });
    }
  }
  return weeks;
}

// 두 날짜 사이의 모든 월(시작월~종료월) 생성
function buildMonthAxis(minDate: Date, maxDate: Date): MonthKey[] {
  const months: MonthKey[] = [];
  const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const stop = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  while (cur <= stop) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0); // 해당 월 마지막 날
    months.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${String(y).slice(2)}.${String(m + 1).padStart(2, '0')}`,
      start,
      end,
      weeks: buildWeeksOfMonth(y, m),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

// [aStart, aEnd] 와 [bStart, bEnd] 가 겹치는지
function rangeOverlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function parseDateSafe(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

// 셀 채움 스타일
function fillStyle(rgb: string) {
  return {
    fill: { patternType: 'solid' as const, fgColor: { rgb } },
    border: ALL_BORDERS,
  };
}

const styleHeaderMonth = {
  font: { name: '맑은 고딕', sz: 10, bold: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'F3F4F6' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  border: ALL_BORDERS,
};

const styleHeaderText = {
  font: { name: '맑은 고딕', sz: 10, bold: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'E5E7EB' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
  border: ALL_BORDERS,
};

const styleCellText = {
  font: { name: '맑은 고딕', sz: 10 },
  alignment: { vertical: 'center' as const, wrapText: true },
  border: ALL_BORDERS,
};

const styleCellCenter = {
  font: { name: '맑은 고딕', sz: 10 },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  border: ALL_BORDERS,
};

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
    const projectId = searchParams.get('projectId') || '';
    const type = searchParams.get('type') || 'detail';
    const favoritesOnly = searchParams.get('favorites') === 'true';
    const status = searchParams.get('status') as ProjectStatus | null;
    const division = searchParams.get('division') || '';

    // 데이터 조회
    const [allProjects, allSchedules, allUsers, allFavorites] = await Promise.all([
      getAllAsObjects<SheetProject>(SHEET_NAMES.PROJECTS),
      getAllAsObjects<SheetSchedule>(SHEET_NAMES.PROJECT_SCHEDULES),
      getAllAsObjects<SheetUser>(SHEET_NAMES.USERS),
      getAllAsObjects<SheetFavorite>(SHEET_NAMES.FAVORITES),
    ]);

    // 사용자 ID -> 이름 매핑
    const userMap = new Map(allUsers.map(u => [u.id, u.name]));

    // 프로젝트 ID -> 프로젝트 매핑
    const projectMap = new Map(allProjects.map(p => [p.id, p]));

    // 현재 사용자의 즐겨찾기 프로젝트 ID Set
    const favoriteProjectIds = new Set(
      allFavorites
        .filter(f => f.userId === session.user.id)
        .map(f => f.projectId)
    );

    let filename: string;
    let ws: XLSX.WorkSheet;
    let useStyledWriter = false;

    if (type === 'gantt-month') {
      // 월단위 셀 기반 간트 (시각화)
      // - projectId가 있으면 해당 프로젝트의 세부추진항목별 행
      // - 없으면 전체 프로젝트의 대일정별 행
      const result = buildMonthGanttSheet({
        projectId,
        favoritesOnly,
        status,
        division,
        allProjects,
        allSchedules,
        userMap,
        favoriteProjectIds,
      });
      ws = result.ws;
      filename = result.filename;
      useStyledWriter = true;
    } else if (type === 'gantt') {
      // 전체 간트차트: 프로젝트 대일정 데이터
      const projects = allProjects.filter((project) => {
        // 상태 필터
        if (status && project.status !== status) {
          return false;
        }

        // 소속 필터
        if (division && project.division !== division) {
          return false;
        }

        // 즐겨찾기 필터
        if (favoritesOnly && !favoriteProjectIds.has(project.id)) {
          return false;
        }

        return true;
      });

      // 시작일 순 정렬
      projects.sort((a, b) =>
        new Date(a.scheduleStart).getTime() - new Date(b.scheduleStart).getTime()
      );

      // Excel 데이터 생성
      const excelData = projects.map((project, index) => ({
        'No': index + 1,
        '프로젝트ID': project.id,
        '상태': project.status,
        '고객사': project.customer,
        'ITEM': project.item,
        '소속': project.division,
        '구분': project.category,
        '팀장': userMap.get(project.teamLeaderId) || project.teamLeaderId,
        '현재단계': project.currentStage,
        '시작일': project.scheduleStart,
        '종료일': project.scheduleEnd,
      }));

      ws = XLSX.utils.json_to_sheet(excelData);

      // 컬럼 너비 설정
      ws['!cols'] = [
        { wch: 5 },   // No
        { wch: 15 },  // 프로젝트ID
        { wch: 8 },   // 상태
        { wch: 15 },  // 고객사
        { wch: 20 },  // ITEM
        { wch: 8 },   // 소속
        { wch: 8 },   // 구분
        { wch: 10 },  // 팀장
        { wch: 10 },  // 현재단계
        { wch: 12 },  // 시작일
        { wch: 12 },  // 종료일
      ];

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      filename = `전체일정표_${today}.xlsx`;
    } else {
      // 세부추진항목: 특정 프로젝트 또는 전체
      let schedules = allSchedules;

      if (projectId) {
        schedules = schedules.filter(s => s.projectId === projectId);
      }

      // 프로젝트ID, order 순 정렬
      schedules.sort((a, b) => {
        if (a.projectId !== b.projectId) {
          return a.projectId.localeCompare(b.projectId);
        }
        return (parseInt(a.order) || 0) - (parseInt(b.order) || 0);
      });

      // Excel 데이터 생성
      const excelData = schedules.map((schedule, index) => {
        const project = projectMap.get(schedule.projectId);
        return {
          'No': index + 1,
          '프로젝트': project ? `${project.customer} - ${project.item}` : schedule.projectId,
          '단계': schedule.stage || '',
          '항목명': schedule.taskName,
          '계획시작일': schedule.plannedStart,
          '계획종료일': schedule.plannedEnd,
          '실적시작일': schedule.actualStart || '',
          '실적종료일': schedule.actualEnd || '',
          '업무구분': getResponsibilityLabel(schedule.responsibility),
          '관련부문': schedule.category || '',
          '상태': getStatusLabel(schedule.status),
          '비고': schedule.note || '',
        };
      });

      ws = XLSX.utils.json_to_sheet(excelData);

      // 컬럼 너비 설정
      ws['!cols'] = [
        { wch: 5 },   // No
        { wch: 30 },  // 프로젝트
        { wch: 10 },  // 단계
        { wch: 30 },  // 항목명
        { wch: 12 },  // 계획시작일
        { wch: 12 },  // 계획종료일
        { wch: 12 },  // 실적시작일
        { wch: 12 },  // 실적종료일
        { wch: 8 },   // 업무구분
        { wch: 10 },  // 관련부문
        { wch: 8 },   // 상태
        { wch: 30 },  // 비고
      ];

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      if (projectId) {
        const project = projectMap.get(projectId);
        const projectName = project ? `${project.customer}_${project.item}`.replace(/[/\\?%*:|"<>]/g, '_') : projectId;
        filename = `일정표_${projectName}_${today}.xlsx`;
      } else {
        filename = `세부추진항목_${today}.xlsx`;
      }
    }

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    const sheetName =
      type === 'gantt-month' ? '간트(월)' : type === 'gantt' ? '전체일정' : '세부추진항목';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Excel 파일 생성 (셀 스타일이 필요한 경우 xlsx-js-style 사용)
    const writer = useStyledWriter ? XLSXStyle : XLSX;
    const buf = writer.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 응답 반환
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('일정 Excel 다운로드 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────
// 월단위 셀 간트 시트 생성
// ────────────────────────────────────────────────

interface BuildMonthGanttArgs {
  projectId: string;
  favoritesOnly: boolean;
  status: ProjectStatus | null;
  division: string;
  allProjects: SheetProject[];
  allSchedules: SheetSchedule[];
  userMap: Map<string, string>;
  favoriteProjectIds: Set<string>;
}

function determineActualStatus(s: SheetSchedule): 'in_progress' | 'completed' | 'delayed' {
  if (s.status === 'completed') return 'completed';
  if (s.status === 'delayed') return 'delayed';
  return 'in_progress';
}

function buildMonthGanttSheet(args: BuildMonthGanttArgs): { ws: XLSX.WorkSheet; filename: string } {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  if (args.projectId) {
    return buildProjectDetailMonthGantt(args, today);
  }
  return buildOverallMonthGantt(args, today);
}

// 프로젝트 단일 — 세부추진항목 (계획+실적 2행) × 월·주차 컬럼
function buildProjectDetailMonthGantt(
  args: BuildMonthGanttArgs,
  today: string,
): { ws: XLSX.WorkSheet; filename: string } {
  const project = args.allProjects.find((p) => p.id === args.projectId);
  const schedules = args.allSchedules
    .filter((s) => s.projectId === args.projectId)
    .sort((a, b) => (parseInt(a.order) || 0) - (parseInt(b.order) || 0));

  // 모든 일정의 계획/실적 날짜에서 최소~최대월 추출
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  const updateRange = (d: Date | null) => {
    if (!d) return;
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  };
  schedules.forEach((s) => {
    updateRange(parseDateSafe(s.plannedStart));
    updateRange(parseDateSafe(s.plannedEnd));
    updateRange(parseDateSafe(s.actualStart));
    updateRange(parseDateSafe(s.actualEnd));
  });

  if (!minDate || !maxDate) {
    const now = new Date();
    minDate = now;
    maxDate = now;
  }

  const months = buildMonthAxis(minDate, maxDate);
  const totalWeekCols = months.length * WEEKS_PER_MONTH;

  // 고정 컬럼 (실적시작/실적종료 제거 — 실적은 행으로 표현)
  const fixedHeaders = ['No', '단계', '항목명', '계획시작', '계획종료', '구분', '상태'];
  const FIXED_LEN = fixedHeaders.length;

  // 2단 헤더: row 0 = 고정 + 월 라벨, row 1 = 빈 고정 + 주차 라벨
  const headerRow0: (string | number)[] = [...fixedHeaders];
  const headerRow1: (string | number)[] = fixedHeaders.map(() => '');
  months.forEach((m) => {
    headerRow0.push(m.label);
    for (let w = 1; w < WEEKS_PER_MONTH; w++) headerRow0.push('');
    m.weeks.forEach((wk) => headerRow1.push(wk.label));
  });

  const aoa: (string | number)[][] = [headerRow0, headerRow1];
  const cellStyles: Record<string, object> = {};
  const merges: XLSX.Range[] = [];

  // 헤더 스타일 + 병합
  // 고정 컬럼: row 0~1 세로 병합
  fixedHeaders.forEach((_, c) => {
    cellStyles[XLSX.utils.encode_cell({ r: 0, c })] = styleHeaderText;
    cellStyles[XLSX.utils.encode_cell({ r: 1, c })] = styleHeaderText;
    merges.push({ s: { r: 0, c }, e: { r: 1, c } });
  });
  // 월 셀: row 0 가로 병합 (5주씩)
  months.forEach((_, mi) => {
    const cStart = FIXED_LEN + mi * WEEKS_PER_MONTH;
    const cEnd = cStart + WEEKS_PER_MONTH - 1;
    cellStyles[XLSX.utils.encode_cell({ r: 0, c: cStart })] = styleHeaderMonth;
    for (let c = cStart + 1; c <= cEnd; c++) {
      cellStyles[XLSX.utils.encode_cell({ r: 0, c })] = styleHeaderMonth;
    }
    merges.push({ s: { r: 0, c: cStart }, e: { r: 0, c: cEnd } });
    // 주차 헤더 (row 1)
    for (let c = cStart; c <= cEnd; c++) {
      cellStyles[XLSX.utils.encode_cell({ r: 1, c })] = styleHeaderMonth;
    }
  });

  // 본문: 각 일정당 2행 (계획, 실적)
  const HEADER_ROWS = 2;
  schedules.forEach((s, idx) => {
    const planRow = HEADER_ROWS + idx * 2;
    const actualRow = planRow + 1;

    const plannedStart = parseDateSafe(s.plannedStart);
    const plannedEnd = parseDateSafe(s.plannedEnd);
    const actualStart = parseDateSafe(s.actualStart);
    const actualEnd = parseDateSafe(s.actualEnd) ?? (actualStart ? new Date() : null);
    const actualStatus = determineActualStatus(s);
    const actualColor = MONTH_GANTT_COLORS[actualStatus];

    const planLine: (string | number)[] = [
      idx + 1,
      s.stage || '',
      s.taskName || '',
      s.plannedStart || '',
      s.plannedEnd || '',
      '계획',
      getStatusLabel(s.status),
    ];
    const actualLine: (string | number)[] = ['', '', '', '', '', '실적', ''];
    // 주차 셀(빈 값) 채우기
    for (let i = 0; i < totalWeekCols; i++) {
      planLine.push('');
      actualLine.push('');
    }
    aoa.push(planLine, actualLine);

    // 고정 컬럼 스타일 + 세로 병합 (구분=c5 제외, 단계=c1은 별도 그룹 병합)
    fixedHeaders.forEach((_, c) => {
      const isCenter = c === 0 || c === 5 || c === 6;
      const style = isCenter ? styleCellCenter : styleCellText;
      cellStyles[XLSX.utils.encode_cell({ r: planRow, c })] = style;
      cellStyles[XLSX.utils.encode_cell({ r: actualRow, c })] = style;
      // 구분(c=5), 단계(c=1) 제외하고 2행 병합 (No/항목명/계획시작/계획종료/상태)
      if (c !== 5 && c !== 1) {
        merges.push({ s: { r: planRow, c }, e: { r: actualRow, c } });
      }
    });

    // 주차 컬럼 색상
    let weekColIdx = 0;
    months.forEach((m) => {
      m.weeks.forEach((wk) => {
        const c = FIXED_LEN + weekColIdx;
        const planAddr = XLSX.utils.encode_cell({ r: planRow, c });
        const actualAddr = XLSX.utils.encode_cell({ r: actualRow, c });

        const validWeek = wk.start <= wk.end;
        const inPlanned =
          validWeek && plannedStart && plannedEnd &&
          rangeOverlaps(wk.start, wk.end, plannedStart, plannedEnd);
        const inActual =
          validWeek && actualStart && actualEnd &&
          rangeOverlaps(wk.start, wk.end, actualStart, actualEnd);

        cellStyles[planAddr] = inPlanned
          ? fillStyle(MONTH_GANTT_COLORS.planned)
          : { border: ALL_BORDERS };
        cellStyles[actualAddr] = inActual
          ? fillStyle(actualColor)
          : { border: ALL_BORDERS };

        weekColIdx++;
      });
    });
  });

  // 동일 단계 연속 묶음 병합 (단계 컬럼 c=1)
  // 같은 단계 그룹의 첫 일정 plan 행 ~ 마지막 일정 actual 행을 병합 (단일 일정도 2행 병합)
  if (schedules.length > 0) {
    let groupStart = 0;
    for (let i = 1; i <= schedules.length; i++) {
      const prev = schedules[i - 1].stage || '';
      const cur = i < schedules.length ? schedules[i].stage || '' : null;
      if (cur !== prev) {
        const startRow = HEADER_ROWS + groupStart * 2;
        const endRow = HEADER_ROWS + (i - 1) * 2 + 1;
        if (endRow > startRow) {
          merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
        }
        groupStart = i;
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  Object.entries(cellStyles).forEach(([addr, style]) => {
    if (ws[addr]) {
      (ws[addr] as XLSX.CellObject).s = style;
    } else {
      ws[addr] = { t: 's', v: '', s: style } as XLSX.CellObject;
    }
  });

  ws['!merges'] = merges;

  // 컬럼 너비
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 10 },  // 단계
    { wch: 28 },  // 항목명
    { wch: 12 },  // 계획시작
    { wch: 12 },  // 계획종료
    { wch: 6 },   // 구분
    { wch: 8 },   // 상태
    ...Array.from({ length: totalWeekCols }, () => ({ wch: 4 })),
  ];

  // 행 높이
  ws['!rows'] = [
    { hpt: 24 }, // 월 헤더
    { hpt: 20 }, // 주차 헤더
    ...schedules.flatMap(() => [{ hpt: 20 }, { hpt: 20 }]),
  ];

  // 헤더 2행 + 좌측 고정 컬럼 freeze
  ws['!freeze'] = { xSplit: FIXED_LEN, ySplit: HEADER_ROWS };

  const projectName = project
    ? `${project.customer}_${project.item}`.replace(/[/\\?%*:|"<>]/g, '_')
    : args.projectId;
  const filename = `간트월_${projectName}_${today}.xlsx`;

  return { ws, filename };
}

// 전체 일정 — 프로젝트 행 × 월 컬럼
function buildOverallMonthGantt(
  args: BuildMonthGanttArgs,
  today: string,
): { ws: XLSX.WorkSheet; filename: string } {
  const projects = args.allProjects.filter((p) => {
    if (args.status && p.status !== args.status) return false;
    if (args.division && p.division !== args.division) return false;
    if (args.favoritesOnly && !args.favoriteProjectIds.has(p.id)) return false;
    return true;
  });

  projects.sort(
    (a, b) =>
      new Date(a.scheduleStart).getTime() - new Date(b.scheduleStart).getTime(),
  );

  // 월 축
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  projects.forEach((p) => {
    const s = parseDateSafe(p.scheduleStart);
    const e = parseDateSafe(p.scheduleEnd);
    if (s && (!minDate || s < minDate)) minDate = s;
    if (e && (!maxDate || e > maxDate)) maxDate = e;
  });
  if (!minDate || !maxDate) {
    const now = new Date();
    minDate = now;
    maxDate = now;
  }
  const months = buildMonthAxis(minDate, maxDate);

  const fixedHeaders = ['No', '상태', '고객사', 'ITEM', '소속', '팀장', '시작일', '종료일'];
  const header = [...fixedHeaders, ...months.map((m) => m.label)];

  const aoa: (string | number)[][] = [header];
  const cellStyles: Record<string, object> = {};

  header.forEach((_, c) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    cellStyles[addr] = c < fixedHeaders.length ? styleHeaderText : styleHeaderMonth;
  });

  projects.forEach((p, idx) => {
    const rowIdx = idx + 1;
    const row: (string | number)[] = [
      idx + 1,
      p.status,
      p.customer || '',
      p.item || '',
      p.division || '',
      args.userMap.get(p.teamLeaderId) || p.teamLeaderId || '',
      p.scheduleStart || '',
      p.scheduleEnd || '',
    ];
    months.forEach(() => row.push(''));
    aoa.push(row);

    fixedHeaders.forEach((_, c) => {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
      cellStyles[addr] = c === 0 || c === 1 ? styleCellCenter : styleCellText;
    });

    const start = parseDateSafe(p.scheduleStart);
    const end = parseDateSafe(p.scheduleEnd);

    months.forEach((m, mi) => {
      const c = fixedHeaders.length + mi;
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
      const inRange = start && end && rangeOverlaps(m.start, m.end, start, end);
      cellStyles[addr] = inRange
        ? fillStyle(MONTH_GANTT_COLORS.project)
        : { border: ALL_BORDERS };
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  Object.entries(cellStyles).forEach(([addr, style]) => {
    if (ws[addr]) {
      (ws[addr] as XLSX.CellObject).s = style;
    } else {
      ws[addr] = { t: 's', v: '', s: style } as XLSX.CellObject;
    }
  });

  ws['!cols'] = [
    { wch: 5 },
    { wch: 8 },
    { wch: 16 },
    { wch: 22 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    ...months.map(() => ({ wch: 8 })),
  ];

  ws['!rows'] = [{ hpt: 30 }, ...projects.map(() => ({ hpt: 22 }))];
  ws['!freeze'] = { xSplit: fixedHeaders.length, ySplit: 1 };

  const filename = `전체간트월_${today}.xlsx`;
  return { ws, filename };
}
