'use client';

/**
 * 주간 보고서 미리보기 클라이언트 컴포넌트
 *
 * - 제출용(isIncluded=true) 항목만 표시
 * - 인쇄/PDF용 레이아웃
 * - PDF 다운로드 버튼
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getKoreanDate,
  getYearMonthWeek,
  getWeekRange,
  formatDateKorean,
} from '@/lib/weekUtils';
import type { WeeklyReport, WeeklyReportNotice } from '@/types';

// 구분 순서
const CATEGORY_ORDER = ['농기', '중공업', '해외', '기타'];

export default function WeeklyReportPreviewClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [notice, setNotice] = useState<WeeklyReportNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // URL에서 주차 정보 가져오기 (한국 시간 기준, ISO 목요일 규칙)
  const now = getKoreanDate();
  const nowInfo = getYearMonthWeek(now);
  const year = parseInt(searchParams.get('year') || String(nowInfo.year));
  const month = parseInt(searchParams.get('month') || String(nowInfo.month));
  const week = parseInt(searchParams.get('week') || String(nowInfo.week));

  const weekRange = getWeekRange(year, month, week);

  // 제출용 주간 보고 조회
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
        week: week.toString(),
        onlyIncluded: 'true',
      });

      const response = await fetch(`/api/weekly-reports?${params}`);
      const data = await response.json();

      if (data.success) {
        setReports(data.data);
      } else {
        setError(data.error || '조회 실패');
      }
    } catch (err) {
      console.error('주간 보고 조회 오류:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [year, month, week]);

  // 공지사항 조회
  const fetchNotice = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
        week: week.toString(),
      });

      const response = await fetch(`/api/weekly-report-notices?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        setNotice(data.data);
      }
    } catch (err) {
      console.error('공지사항 조회 오류:', err);
    }
  }, [year, month, week]);

  useEffect(() => {
    fetchReports();
    fetchNotice();
  }, [fetchReports, fetchNotice]);

  // 구분별로 그룹핑
  const groupedReports: Record<string, WeeklyReport[]> = {};
  CATEGORY_ORDER.forEach((category) => {
    groupedReports[category] = [];
  });

  reports.forEach((report) => {
    const category = report.categoryId || '기타';
    if (!groupedReports[category]) {
      groupedReports[category] = [];
    }
    groupedReports[category].push(report);
  });

  // 인쇄
  const handlePrint = () => {
    window.print();
  };

  // PDF 다운로드 (인쇄 다이얼로그 활용)
  const handleDownloadPDF = () => {
    // 브라우저 인쇄 기능을 사용하여 PDF로 저장
    window.print();
  };

  // Excel 다운로드
  const handleDownloadExcel = () => {
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
      week: week.toString(),
    });
    window.location.href = `/api/export/weekly-reports?${params}`;
  };

  // 목록으로 돌아가기
  const handleBack = () => {
    router.push('/weekly-reports');
  };

  // 행 번호 계산
  let rowNumber = 0;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 툴바 (인쇄 시 숨김) */}
      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="text-gray-600 hover:text-gray-800"
            >
              ← 목록으로
            </button>
            <h1 className="text-lg font-semibold text-gray-800">
              보고서 미리보기
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadExcel}
              style={{ backgroundColor: '#217346' }}
              className="px-4 py-2 text-white rounded-md hover:brightness-110 transition-all"
            >
              📊 엑셀 다운로드
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              🖨️ 인쇄
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              📄 PDF 저장
            </button>
          </div>
        </div>
      </div>

      {/* 미리보기 영역 */}
      <div className="max-w-5xl mx-auto py-8 px-6 print:p-0 print:max-w-none">
        <div
          ref={printRef}
          className="bg-white shadow-lg rounded-lg p-8 print:shadow-none print:rounded-none"
        >
          {/* 보고서 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              연구소 주간 업무 보고
            </h1>
            <p className="text-lg text-gray-600">
              {year}년 {month}월 {week}주차 ({formatDateKorean(weekRange.start)} ~ {formatDateKorean(weekRange.end)})
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-md mb-4 print:hidden">
              {error}
            </div>
          )}

          {/* 로딩 */}
          {loading ? (
            <div className="flex justify-center items-center py-12 print:hidden">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>제출용으로 선택된 보고가 없습니다.</p>
              <Link
                href="/weekly-reports"
                className="inline-block mt-4 text-blue-600 hover:underline print:hidden"
              >
                ← 목록으로 돌아가기
              </Link>
            </div>
          ) : (
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700 w-12">
                      No
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700 w-24">
                      구분
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700 w-40">
                      고객사/ITEM
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      주요 추진 실적 및 계획
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_ORDER.map((category) => {
                    const categoryReports = groupedReports[category] || [];
                    if (categoryReports.length === 0) return null;

                    return categoryReports.map((report, index) => {
                      rowNumber++;
                      const isFirst = index === 0;

                      return (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 text-center">
                            {rowNumber}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                            {isFirst && (
                              <span className="font-medium">{category}</span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-sm">
                            <div className="font-medium text-gray-800">
                              {report.customer}
                            </div>
                            <div className="text-gray-600 text-xs">
                              {report.item}
                            </div>
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                            {report.content}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 공지사항 섹션 */}
          {notice?.content && (
            <div className="mt-6 border border-gray-300 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-100 border-b border-gray-300">
                <h3 className="font-semibold text-sm text-gray-700">
                  📢 공지사항 (요청사항)
                </h3>
              </div>
              <div className="p-4">
                <ul className="space-y-1 text-sm text-gray-700">
                  {notice.content.split('\n').filter(line => line.trim()).map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 푸터 */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>총 {reports.length}건</p>
          </div>
        </div>
      </div>

      {/* 인쇄용 스타일 */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:max-w-none {
            max-width: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}