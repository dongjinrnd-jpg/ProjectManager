'use client';

/**
 * 주간 보고 목록 클라이언트 컴포넌트
 *
 * 새로운 요구사항:
 * - 모든 등록된 보고는 항상 표시 (숨기기 개념 제거)
 * - 제출용 토글 (👁️ 눈 아이콘) - 보고서에 포함/제외
 * - 보고서 미리보기 버튼 (admin 전용)
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import WeeklyReportPreviewModal from './WeeklyReportPreviewModal';
import {
  getKoreanDate,
  getYearMonthWeek,
  getWeekRange,
  getTotalWeeksInMonth,
  formatDate,
  formatDateDisplay,
} from '@/lib/weekUtils';
import type { WeeklyReport, WeeklyReportNotice } from '@/types';

// 구분 순서 (Roadmap 기준)
const CATEGORY_ORDER = ['농기', '중공업', '해외', '기타'];

export default function WeeklyReportsClient() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 공지사항 상태
  const [notice, setNotice] = useState<WeeklyReportNotice | null>(null);
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [noticeContent, setNoticeContent] = useState('');

  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // 현재 선택된 주차 (한국 시간 기준, ISO 목요일 규칙)
  const now = getKoreanDate();
  const currentInfo = getYearMonthWeek(now);
  const [selectedYear, setSelectedYear] = useState(currentInfo.year);
  const [selectedMonth, setSelectedMonth] = useState(currentInfo.month);
  const [selectedWeek, setSelectedWeek] = useState(currentInfo.week);

  // 사용자 권한
  const userId = session?.user?.id;
  const isAdmin = session?.user?.role === 'admin';
  const canCreate = session?.user?.role === 'admin' || session?.user?.role === 'engineer';

  // 수정 가능 여부 확인 (admin 또는 작성자)
  const canEdit = (report: WeeklyReport) => isAdmin || report.createdById === userId;

  // 주차 범위 계산
  const weekRange = getWeekRange(selectedYear, selectedMonth, selectedWeek);

  // 주간 보고 목록 조회
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
        week: selectedWeek.toString(),
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
  }, [selectedYear, selectedMonth, selectedWeek]);

  // 공지사항 조회
  const fetchNotice = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
        week: selectedWeek.toString(),
      });

      const response = await fetch(`/api/weekly-report-notices?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        setNotice(data.data);
        setNoticeContent(data.data.content || '');
      } else {
        setNotice(null);
        setNoticeContent('');
      }
    } catch (err) {
      console.error('공지사항 조회 오류:', err);
    }
  }, [selectedYear, selectedMonth, selectedWeek]);

  // 공지사항 저장
  const handleSaveNotice = async () => {
    try {
      const response = await fetch('/api/weekly-report-notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          month: selectedMonth,
          week: selectedWeek,
          content: noticeContent,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNotice(data.data);
        setIsEditingNotice(false);
      } else {
        alert(data.error || '저장 실패');
      }
    } catch (err) {
      console.error('공지사항 저장 오류:', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    fetchReports();
    fetchNotice();
  }, [fetchReports, fetchNotice]);

  // 이전 주
  const handlePrevWeek = () => {
    let newWeek = selectedWeek - 1;
    let newMonth = selectedMonth;
    let newYear = selectedYear;

    if (newWeek < 1) {
      newMonth -= 1;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }
      newWeek = getTotalWeeksInMonth(newYear, newMonth);
    }

    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    setSelectedWeek(newWeek);
  };

  // 다음 주
  const handleNextWeek = () => {
    let newWeek = selectedWeek + 1;
    let newMonth = selectedMonth;
    let newYear = selectedYear;

    const maxWeek = getTotalWeeksInMonth(newYear, newMonth);

    if (newWeek > maxWeek) {
      newWeek = 1;
      newMonth += 1;
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
    }

    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    setSelectedWeek(newWeek);
  };

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

  // 순서 변경 (위로)
  const handleMoveUp = async (report: WeeklyReport, categoryReports: WeeklyReport[]) => {
    const currentIndex = categoryReports.findIndex((r) => r.id === report.id);
    if (currentIndex <= 0) return;

    const prevReport = categoryReports[currentIndex - 1];

    try {
      await fetch('/api/weekly-reports/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { id: report.id, order: prevReport.order },
            { id: prevReport.id, order: report.order },
          ],
        }),
      });

      fetchReports();
    } catch (err) {
      console.error('순서 변경 오류:', err);
    }
  };

  // 순서 변경 (아래로)
  const handleMoveDown = async (report: WeeklyReport, categoryReports: WeeklyReport[]) => {
    const currentIndex = categoryReports.findIndex((r) => r.id === report.id);
    if (currentIndex >= categoryReports.length - 1) return;

    const nextReport = categoryReports[currentIndex + 1];

    try {
      await fetch('/api/weekly-reports/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { id: report.id, order: nextReport.order },
            { id: nextReport.id, order: report.order },
          ],
        }),
      });

      fetchReports();
    } catch (err) {
      console.error('순서 변경 오류:', err);
    }
  };

  // 제출용 토글 (isIncluded)
  const handleToggleIncluded = async (report: WeeklyReport) => {
    // isIncluded가 undefined거나 빈값이면 기본 true로 처리
    const currentValue = String(report.isIncluded).toLowerCase();
    const isCurrentlyIncluded = currentValue !== 'false';
    const newValue = !isCurrentlyIncluded;

    try {
      const response = await fetch(`/api/weekly-reports/${report.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isIncluded: newValue }),
      });
      const data = await response.json();
      if (data.success) {
        fetchReports();
      } else {
        alert(data.error || '변경 실패');
      }
    } catch (err) {
      console.error('제출용 토글 오류:', err);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  // 보고서 미리보기 모달 열기
  const handlePreview = () => {
    setShowPreviewModal(true);
  };

  // 행 번호 계산
  let rowNumber = 0;

  // 제출용 항목 수 계산
  const includedCount = reports.filter(
    (r) => String(r.isIncluded).toLowerCase() !== 'false'
  ).length;

  return (
    <AppLayout>
      <div className="p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
            📋 주간 업무 보고
          </h1>
          <div className="flex items-center gap-2">
            {/* 보고서 미리보기 버튼 - admin만 */}
            {isAdmin && reports.length > 0 && (
              <button
                onClick={handlePreview}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                👁️ 보고서 미리보기
                <span className="text-xs bg-blue-500 px-2 py-0.5 rounded">
                  {includedCount}건
                </span>
              </button>
            )}
            {canCreate && (
              <Link
                href="/weekly-reports/new"
                className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors"
              >
                + 보고 등록
              </Link>
            )}
          </div>
        </div>

        {/* 주차 선택 */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={handlePrevWeek}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 rounded-md transition-colors text-lg font-bold"
          >
            ◀
          </button>
          <span className="text-lg font-medium text-gray-800">
            {selectedYear}년 {selectedMonth}월 {selectedWeek}주차 (
            {formatDateDisplay(formatDate(weekRange.start))} ~{' '}
            {formatDateDisplay(formatDate(weekRange.end))})
          </span>
          <button
            onClick={handleNextWeek}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 rounded-md transition-colors text-lg font-bold"
          >
            ▶
          </button>
        </div>

        {/* 구분선 */}
        <div className="border-t-2 border-brand-primary mb-4"></div>

        {/* 제목 */}
        <h2 className="text-lg font-semibold text-center mb-4 text-gray-800">
          {selectedYear}년 {selectedMonth}월 {selectedWeek}주차 연구소 업무 보고
        </h2>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-md mb-4">
            {error}
          </div>
        )}

        {/* 로딩 */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>등록된 주간 보고가 없습니다.</p>
            {canCreate && (
              <Link
                href="/weekly-reports/new"
                className="inline-block mt-4 px-4 py-2 bg-brand-primary text-white rounded-md"
              >
                + 보고 등록하기
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-12">
                    No
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 w-16">
                    제출
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-24">
                    구분
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-40">
                    고객사/ITEM
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    주요 추진 실적 및 계획
                  </th>
                  {(isAdmin || canCreate) && (
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 w-28">
                      관리
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map((category) => {
                  const categoryReports = groupedReports[category] || [];
                  if (categoryReports.length === 0) return null;

                  return categoryReports.map((report, index) => {
                    rowNumber++;
                    const isFirst = index === 0;
                    const isLast = index === categoryReports.length - 1;
                    const isIncluded = String(report.isIncluded).toLowerCase() !== 'false';

                    return (
                      <tr
                        key={report.id}
                        className={`border-b transition-colors ${
                          !isIncluded
                            ? 'bg-gray-50 text-gray-400'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3 text-sm">
                          {rowNumber}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {/* 제출용 토글 - admin만 */}
                          {isAdmin ? (
                            <button
                              onClick={() => handleToggleIncluded(report)}
                              className={`text-xl transition-colors ${
                                isIncluded
                                  ? 'text-blue-600 hover:text-blue-800'
                                  : 'text-gray-300 hover:text-gray-500'
                              }`}
                              title={isIncluded ? '제출에서 제외' : '제출에 포함'}
                            >
                              {isIncluded ? '👁️' : '👁️‍🗨️'}
                            </button>
                          ) : (
                            <span className={`text-xl ${isIncluded ? 'text-blue-600' : 'text-gray-300'}`}>
                              {isIncluded ? '👁️' : '👁️‍🗨️'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isFirst && (
                            <span className="font-medium text-gray-800">{category}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className={`font-medium ${isIncluded ? 'text-gray-800' : 'text-gray-400'}`}>
                            {report.customer}
                          </div>
                          <div className={`text-xs ${isIncluded ? 'text-gray-600' : 'text-gray-400'}`}>
                            {report.item}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm whitespace-pre-wrap ${isIncluded ? 'text-gray-700' : 'text-gray-400'}`}>
                          {report.content}
                        </td>
                        {(isAdmin || canCreate) && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* 순서 변경: admin만 */}
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => handleMoveUp(report, categoryReports)}
                                    disabled={isFirst}
                                    className={`p-1 rounded ${
                                      isFirst
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                    title="위로"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => handleMoveDown(report, categoryReports)}
                                    disabled={isLast}
                                    className={`p-1 rounded ${
                                      isLast
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                    title="아래로"
                                  >
                                    ↓
                                  </button>
                                </>
                              )}
                              {/* 수정: admin 또는 작성자 */}
                              {canEdit(report) && (
                                <Link
                                  href={`/weekly-reports/${report.id}/edit`}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  title="수정"
                                >
                                  ✏️
                                </Link>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 공지사항 섹션 */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              📢 공지사항 (요청사항)
            </h3>
            {isAdmin && !isEditingNotice && (
              <button
                onClick={() => setIsEditingNotice(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                편집
              </button>
            )}
          </div>
          <div className="p-4">
            {isEditingNotice ? (
              <div className="space-y-3">
                <textarea
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  placeholder="공지사항을 입력하세요. 줄바꿈으로 항목을 구분합니다."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsEditingNotice(false);
                      setNoticeContent(notice?.content || '');
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveNotice}
                    className="px-3 py-1.5 text-sm bg-brand-primary text-white rounded-md hover:bg-brand-primary/90"
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : notice?.content ? (
              <ul className="space-y-1 text-sm text-gray-700">
                {notice.content.split('\n').filter(line => line.trim()).map((line, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">
                등록된 공지사항이 없습니다.
                {isAdmin && ' [편집] 버튼을 눌러 추가하세요.'}
              </p>
            )}
          </div>
        </div>

        {/* TODO: 주간 보고 요약 섹션 */}
      </div>

      {/* 미리보기 모달 */}
      <WeeklyReportPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        reports={reports}
        notice={notice}
        year={selectedYear}
        month={selectedMonth}
        week={selectedWeek}
        weekStart={formatDateDisplay(formatDate(weekRange.start))}
        weekEnd={formatDateDisplay(formatDate(weekRange.end))}
      />
    </AppLayout>
  );
}