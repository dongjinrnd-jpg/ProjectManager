'use client';

/**
 * 주간 보고서 미리보기 모달
 *
 * - 제출용(isIncluded=true) 항목만 표시
 * - 인쇄/PDF 저장 버튼
 */

import { useRef } from 'react';
import type { WeeklyReport, WeeklyReportNotice } from '@/types';

// 구분 순서
const CATEGORY_ORDER = ['농기', '중공업', '해외', '기타'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reports: WeeklyReport[];
  notice: WeeklyReportNotice | null;
  year: number;
  month: number;
  week: number;
  weekStart: string;
  weekEnd: string;
}

export default function WeeklyReportPreviewModal({
  isOpen,
  onClose,
  reports,
  notice,
  year,
  month,
  week,
  weekStart,
  weekEnd,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // 제출용만 필터링
  const includedReports = reports.filter(
    (r) => String(r.isIncluded).toLowerCase() !== 'false'
  );

  // 구분별로 그룹핑
  const groupedReports: Record<string, WeeklyReport[]> = {};
  CATEGORY_ORDER.forEach((category) => {
    groupedReports[category] = [];
  });

  includedReports.forEach((report) => {
    const category = report.categoryId || '기타';
    if (!groupedReports[category]) {
      groupedReports[category] = [];
    }
    groupedReports[category].push(report);
  });

  // 인쇄
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>주간 업무 보고 - ${year}년 ${month}월 ${week}주차</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
            h1 { text-align: center; font-size: 20px; margin-bottom: 8px; }
            .subtitle { text-align: center; color: #666; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; font-size: 12px; }
            th { background: #f5f5f5; font-weight: 600; }
            .customer { font-weight: 500; }
            .item { color: #666; font-size: 11px; }
            .content { white-space: pre-wrap; }
            .notice { border: 1px solid #ccc; border-radius: 4px; margin-top: 16px; }
            .notice-header { background: #f5f5f5; padding: 8px 12px; font-weight: 600; font-size: 13px; border-bottom: 1px solid #ccc; }
            .notice-body { padding: 12px; }
            .notice-body ul { list-style: none; }
            .notice-body li { margin-bottom: 4px; font-size: 12px; }
            .notice-body li::before { content: "• "; color: #999; }
            .footer { text-align: center; color: #999; font-size: 11px; margin-top: 20px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // 행 번호 계산
  let rowNumber = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            보고서 미리보기
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
            >
              🖨️ 인쇄 / PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto p-6">
          <div ref={printRef}>
            {/* 보고서 헤더 */}
            <h1 className="text-xl font-bold text-center text-gray-800 mb-1">
              연구소 주간 업무 보고
            </h1>
            <p className="subtitle text-center text-gray-600 mb-6">
              {year}년 {month}월 {week}주차 ({weekStart} ~ {weekEnd})
            </p>

            {/* 테이블 */}
            {includedReports.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                제출용으로 선택된 보고가 없습니다.
              </p>
            ) : (
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 w-12">
                      No
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 w-20">
                      구분
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 w-36">
                      고객사/ITEM
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">
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
                        <tr key={report.id}>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700 text-center">
                            {rowNumber}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700">
                            {isFirst && (
                              <span className="font-medium">{category}</span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm">
                            <div className="customer font-medium text-gray-800">
                              {report.customer}
                            </div>
                            <div className="item text-gray-600 text-xs">
                              {report.item}
                            </div>
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700 content whitespace-pre-wrap">
                            {report.content}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            )}

            {/* 공지사항 */}
            {notice?.content && (
              <div className="notice mt-4 border border-gray-300 rounded-lg overflow-hidden">
                <div className="notice-header bg-gray-100 px-3 py-2 border-b border-gray-300">
                  📢 공지사항 (요청사항)
                </div>
                <div className="notice-body p-3">
                  <ul className="space-y-1 text-sm text-gray-700">
                    {notice.content.split('\n').filter(line => line.trim()).map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 푸터 */}
            <div className="footer text-center text-sm text-gray-500 mt-6">
              총 {includedReports.length}건
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}