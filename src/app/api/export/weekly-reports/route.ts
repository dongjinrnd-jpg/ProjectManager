/**
 * 주간 보고 Excel 다운로드 API
 *
 * GET /api/export/weekly-reports?year=&month=&week=
 *
 * 웹 미리보기 양식과 동일하게 출력:
 * - 상단 타이틀 (연구소 주간 업무 보고 / YYYY년 M월 W주차 (start ~ end))
 * - 컬럼: No / 구분 / 고객사·ITEM(2줄) / 주요 추진 실적 및 계획
 * - 같은 구분이 연속되면 셀 병합
 * - 셀 자동 줄바꿈, 행 높이 자동 조정
 * - 공지사항이 있으면 별도 시트
 *
 * 권한: 로그인 사용자
 */

import { NextResponse } from 'next/server';
import XLSX from 'xlsx-js-style';
import { getAllAsObjects, SHEET_NAMES } from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import { getWeekRange, formatDateKorean } from '@/lib/weekUtils';

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
  isIncluded?: boolean;
}

interface SheetWeeklyReportNotice extends Record<string, unknown> {
  id: string;
  year: number;
  month: number;
  week: number;
  content: string;
}

const CATEGORY_ORDER = ['농기', '중공업', '해외', '기타'];

// 공통 스타일
const BORDER_THIN = { style: 'thin' as const, color: { rgb: '000000' } };
const ALL_BORDERS = {
  top: BORDER_THIN,
  bottom: BORDER_THIN,
  left: BORDER_THIN,
  right: BORDER_THIN,
};

const styleTitle = {
  font: { name: '맑은 고딕', sz: 16, bold: true },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
};

const styleSubtitle = {
  font: { name: '맑은 고딕', sz: 11, color: { rgb: '666666' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
};

const styleHeader = {
  font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: '333333' } },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'F3F4F6' } },
  alignment: {
    horizontal: 'center' as const,
    vertical: 'center' as const,
    wrapText: true,
  },
  border: ALL_BORDERS,
};

const styleCellBase = {
  font: { name: '맑은 고딕', sz: 10 },
  alignment: { vertical: 'center' as const, wrapText: true },
  border: ALL_BORDERS,
};

const styleCellCenter = {
  ...styleCellBase,
  alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
};

const styleCustomerItem = {
  font: { name: '맑은 고딕', sz: 10 },
  alignment: { vertical: 'center' as const, wrapText: true },
  border: ALL_BORDERS,
};

const styleNoticeHeader = {
  font: { name: '맑은 고딕', sz: 11, bold: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'F3F4F6' } },
  alignment: { vertical: 'center' as const },
  border: ALL_BORDERS,
};

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');
    const weekStr = searchParams.get('week');

    if (!yearStr || !monthStr || !weekStr) {
      return NextResponse.json(
        { success: false, error: 'year, month, week 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const week = parseInt(weekStr);

    const [allReports, allNotices] = await Promise.all([
      getAllAsObjects<SheetWeeklyReport>(SHEET_NAMES.WEEKLY_REPORTS),
      getAllAsObjects<SheetWeeklyReportNotice>(SHEET_NAMES.WEEKLY_REPORT_NOTICES),
    ]);

    // 제출용 + 해당 주차 필터링
    const reports = allReports
      .filter((r) => {
        const isIncluded = String(r.isIncluded).toLowerCase() !== 'false';
        return (
          isIncluded &&
          String(r.year) === yearStr &&
          String(r.month) === monthStr &&
          String(r.week) === weekStr
        );
      })
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    // 구분 순서대로 정렬된 평탄화 리스트
    const grouped: Record<string, SheetWeeklyReport[]> = {};
    CATEGORY_ORDER.forEach((c) => (grouped[c] = []));
    reports.forEach((r) => {
      const c = r.categoryId || '기타';
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(r);
    });

    type Row = { category: string; isFirstOfCategory: boolean; report: SheetWeeklyReport };
    const orderedRows: Row[] = [];
    CATEGORY_ORDER.forEach((category) => {
      const list = grouped[category] || [];
      list.forEach((report, idx) => {
        orderedRows.push({ category, isFirstOfCategory: idx === 0, report });
      });
    });

    // 시트 데이터 (AOA, 행 단위 배열)
    const weekRange = getWeekRange(year, month, week);
    const subtitle = `${year}년 ${month}월 ${week}주차 (${formatDateKorean(weekRange.start)} ~ ${formatDateKorean(weekRange.end)})`;
    const headerRow = ['No', '구분', '고객사/ITEM', '주요 추진 실적 및 계획'];

    // 공지사항 미리 조회 (있으면 같은 시트 하단에 추가)
    const notice = allNotices.find(
      (n) =>
        String(n.year) === yearStr &&
        String(n.month) === monthStr &&
        String(n.week) === weekStr
    );
    const noticeLines = notice?.content
      ? notice.content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
      : [];

    const aoa: (string | number)[][] = [];
    aoa.push(['연구소 주간 업무 보고', '', '', '']); // row 1 (idx 0)
    aoa.push([subtitle, '', '', '']);                 // row 2 (idx 1)
    aoa.push(['', '', '', '']);                        // row 3 (idx 2) — 여백
    aoa.push(headerRow);                               // row 4 (idx 3)

    orderedRows.forEach((row, i) => {
      const customerItem = `${row.report.customer}\n${row.report.item}`;
      aoa.push([
        i + 1,
        row.isFirstOfCategory ? row.category : '',
        customerItem,
        row.report.content || '',
      ]);
    });

    if (orderedRows.length === 0) {
      aoa.push(['', '', '', '제출용으로 선택된 보고가 없습니다.']);
    }

    // 공지사항을 같은 시트 하단에 추가 (한 행 띄움 + 헤더 + 라인들)
    const dataRowCount = orderedRows.length === 0 ? 1 : orderedRows.length;
    let noticeGapRowIdx = -1;       // 빈 구분 행 (0-based)
    let noticeHeaderRowIdx = -1;    // 공지사항 헤더 행
    let noticeFirstLineIdx = -1;    // 공지사항 첫 번째 라인 행
    if (noticeLines.length > 0) {
      noticeGapRowIdx = 4 + dataRowCount;
      noticeHeaderRowIdx = noticeGapRowIdx + 1;
      noticeFirstLineIdx = noticeGapRowIdx + 2;
      aoa.push(['', '', '', '']);                              // 빈 구분 행
      aoa.push(['📢 공지사항 (요청사항)', '', '', '']);          // 헤더 (병합)
      noticeLines.forEach((line) => aoa.push([`• ${line}`, '', '', '']));
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 컬럼 너비
    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 10 },  // 구분
      { wch: 22 },  // 고객사/ITEM
      { wch: 58 },  // 주요 추진 실적 및 계획
    ];

    // 행 높이 (타이틀/서브타이틀/여백/헤더)
    const rows: { hpt: number }[] = [
      { hpt: 28 }, // 타이틀
      { hpt: 20 }, // 서브타이틀
      { hpt: 8 },  // 여백
      { hpt: 28 }, // 헤더
    ];

    // 데이터 행 높이 — 내용 줄 수에 비례
    const lineHeight = 16;
    const minRowHeight = 36;
    orderedRows.forEach((row) => {
      const contentLines = (row.report.content || '').split('\n').length;
      const customerItemLines = 2; // 고객사 + ITEM 2줄
      const lines = Math.max(contentLines, customerItemLines);
      rows.push({ hpt: Math.max(minRowHeight, lines * lineHeight + 8) });
    });
    if (orderedRows.length === 0) {
      rows.push({ hpt: minRowHeight });
    }
    // 공지사항 행 높이
    if (noticeLines.length > 0) {
      rows.push({ hpt: 12 });  // 빈 구분 행 (작게)
      rows.push({ hpt: 24 });  // 공지사항 헤더
      noticeLines.forEach(() => rows.push({ hpt: 22 }));
    }
    ws['!rows'] = rows;

    // 셀 병합
    const merges: XLSX.Range[] = [];
    // 타이틀 (A1:D1) / 서브타이틀 (A2:D2) / 여백 (A3:D3)
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 3 } });
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 3 } });

    // 같은 구분 연속 셀 병합 (B 열)
    const dataStartRow = 4; // 0-based row index of first data row
    let cursor = 0;
    while (cursor < orderedRows.length) {
      const cat = orderedRows[cursor].category;
      let end = cursor;
      while (end + 1 < orderedRows.length && orderedRows[end + 1].category === cat) {
        end++;
      }
      if (end > cursor) {
        merges.push({
          s: { r: dataStartRow + cursor, c: 1 },
          e: { r: dataStartRow + end, c: 1 },
        });
      }
      cursor = end + 1;
    }

    // 공지사항 영역 병합 (A:D)
    if (noticeLines.length > 0) {
      merges.push({ s: { r: noticeGapRowIdx, c: 0 }, e: { r: noticeGapRowIdx, c: 3 } });
      merges.push({ s: { r: noticeHeaderRowIdx, c: 0 }, e: { r: noticeHeaderRowIdx, c: 3 } });
      noticeLines.forEach((_, i) => {
        merges.push({
          s: { r: noticeFirstLineIdx + i, c: 0 },
          e: { r: noticeFirstLineIdx + i, c: 3 },
        });
      });
    }

    ws['!merges'] = merges;

    // 인쇄 설정: A4 / 여백 좁게 / 가로 1페이지에 맞춤 / 헤더 행 반복
    // Excel "좁게" 프리셋: 위·아래 0.75", 좌·우 0.25", 머리글·바닥글 0.3"
    ws['!margins'] = {
      left: 0.25,
      right: 0.25,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    };
    // paperSize 9 = A4
    (ws as unknown as { '!pageSetup': object })['!pageSetup'] = {
      paperSize: 9,
      orientation: 'portrait',
      fitToWidth: 1,
      fitToHeight: 0,
    };
    // 인쇄 시 4행(헤더)을 모든 페이지 상단에 반복
    ws['!printHeader'] = [4, 4];

    // 셀 스타일 적용
    const setStyle = (addr: string, style: object) => {
      if (ws[addr]) {
        (ws[addr] as XLSX.CellObject).s = style;
      }
    };

    setStyle('A1', styleTitle);
    setStyle('A2', styleSubtitle);

    // 헤더
    ['A4', 'B4', 'C4', 'D4'].forEach((addr) => setStyle(addr, styleHeader));

    // 데이터 행
    orderedRows.forEach((_, i) => {
      const r = dataStartRow + i + 1; // 1-based row number
      setStyle(`A${r}`, styleCellCenter);
      setStyle(`B${r}`, styleCellCenter);
      setStyle(`C${r}`, styleCustomerItem);
      setStyle(`D${r}`, styleCellBase);
    });

    if (orderedRows.length === 0) {
      const r = dataStartRow + 1;
      setStyle(`A${r}`, styleCellCenter);
      setStyle(`B${r}`, styleCellCenter);
      setStyle(`C${r}`, styleCellCenter);
      setStyle(`D${r}`, styleCellCenter);
    }

    // 공지사항 스타일 (같은 시트 하단)
    if (noticeLines.length > 0) {
      // 빈 구분 행은 스타일 없음 (보더도 없음)
      const headerR = noticeHeaderRowIdx + 1; // 1-based
      setStyle(`A${headerR}`, styleNoticeHeader);
      setStyle(`B${headerR}`, styleNoticeHeader);
      setStyle(`C${headerR}`, styleNoticeHeader);
      setStyle(`D${headerR}`, styleNoticeHeader);
      noticeLines.forEach((_, i) => {
        const r = noticeFirstLineIdx + i + 1;
        setStyle(`A${r}`, styleCellBase);
        setStyle(`B${r}`, styleCellBase);
        setStyle(`C${r}`, styleCellBase);
        setStyle(`D${r}`, styleCellBase);
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${year}-${month}-${week}주차`);

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `주간업무보고_${year}-${String(month).padStart(2, '0')}-${week}주차.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('주간보고 Excel 다운로드 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
