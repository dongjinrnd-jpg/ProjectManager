'use client';

/**
 * 주간 보고 등록/수정 폼 클라이언트 컴포넌트
 *
 * Roadmap 2.21 기준
 * - 주차 선택
 * - 구분 → 고객사 → ITEM 연계 드롭다운
 * - 업무일지 불러오기
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import type { WeeklyReport, Project } from '@/types';
import WorklogImportModal from './WorklogImportModal';
import { getWeekOfMonth, getWeekRange, getTotalWeeksInMonth, formatDate } from '@/lib/weekUtils';

// 구분 옵션
const CATEGORY_OPTIONS = ['농기', '중공업', '해외', '기타'];

interface WeeklyReportFormClientProps {
  editMode?: boolean;
  reportId?: string;
}

export default function WeeklyReportFormClient({
  editMode = false,
  reportId,
}: WeeklyReportFormClientProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 프로젝트 목록
  const [projects, setProjects] = useState<Project[]>([]);

  // 업무일지 불러오기 모달
  const [showImportModal, setShowImportModal] = useState(false);

  // 현재 주차 기본값
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;
  const defaultWeek = getWeekOfMonth(now);
  const defaultWeekRange = getWeekRange(defaultYear, defaultMonth, defaultWeek);

  // 폼 데이터
  const [formData, setFormData] = useState({
    year: defaultYear,
    month: defaultMonth,
    week: defaultWeek,
    weekStart: formatDate(defaultWeekRange.start),
    weekEnd: formatDate(defaultWeekRange.end),
    categoryId: '',
    customer: '',
    item: '',
    projectId: '',
    content: '',
  });

  // 프로젝트 목록 조회
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        // 진행중인 프로젝트만
        setProjects(data.data.filter((p: Project) => p.status === '진행중'));
      }
    } catch (err) {
      console.error('프로젝트 목록 조회 오류:', err);
    }
  }, []);

  // 기존 보고서 조회 (수정 모드)
  const fetchReport = useCallback(async () => {
    if (!editMode || !reportId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/weekly-reports/${reportId}`);
      const data = await response.json();

      if (data.success) {
        const report: WeeklyReport = data.data;
        setFormData({
          year: report.year,
          month: report.month,
          week: report.week,
          weekStart: report.weekStart,
          weekEnd: report.weekEnd,
          categoryId: report.categoryId,
          customer: report.customer,
          item: report.item,
          projectId: report.projectId || '',
          content: report.content,
        });
      } else {
        setError(data.error || '조회 실패');
      }
    } catch (err) {
      console.error('주간 보고 조회 오류:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [editMode, reportId]);

  useEffect(() => {
    fetchProjects();
    fetchReport();
  }, [fetchProjects, fetchReport]);

  // 주차 변경 시 날짜 범위 업데이트
  const handleWeekChange = (year: number, month: number, week: number) => {
    const range = getWeekRange(year, month, week);
    setFormData((prev) => ({
      ...prev,
      year,
      month,
      week,
      weekStart: formatDate(range.start),
      weekEnd: formatDate(range.end),
    }));
  };

  // 구분별 고객사 필터링
  const filteredCustomers = projects
    .filter((p) => !formData.categoryId || p.category === formData.categoryId)
    .map((p) => p.customer)
    .filter((v, i, a) => a.indexOf(v) === i) // 중복 제거
    .sort();

  // 고객사별 ITEM 필터링
  const filteredItems = projects
    .filter(
      (p) =>
        (!formData.categoryId || p.category === formData.categoryId) &&
        (!formData.customer || p.customer === formData.customer)
    )
    .map((p) => ({ item: p.item, projectId: p.id }))
    .filter((v, i, a) => a.findIndex((t) => t.item === v.item) === i) // 중복 제거
    .sort((a, b) => a.item.localeCompare(b.item));

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoryId || !formData.customer || !formData.item || !formData.content) {
      setError('필수 항목을 모두 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const url = editMode
        ? `/api/weekly-reports/${reportId}`
        : '/api/weekly-reports';
      const method = editMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/weekly-reports');
      } else {
        setError(data.error || '저장 실패');
      }
    } catch (err) {
      console.error('주간 보고 저장 오류:', err);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 업무일지 불러오기 완료 핸들러
  const handleImportWorklogs = (content: string) => {
    setFormData((prev) => ({
      ...prev,
      content: prev.content ? prev.content + '\n' + content : content,
    }));
    setShowImportModal(false);
  };

  // 주차 옵션 생성 (해당 월의 주차)
  const getWeekOptions = () => {
    const maxWeek = getTotalWeeksInMonth(formData.year, formData.month);
    return Array.from({ length: maxWeek }, (_, i) => i + 1);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
          📋 주간 보고 {editMode ? '수정' : '등록'}
        </h1>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-md mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본 정보 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">기본 정보</h2>

          {/* 주차 선택 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연도 *
              </label>
              <select
                value={formData.year}
                onChange={(e) =>
                  handleWeekChange(
                    parseInt(e.target.value),
                    formData.month,
                    formData.week
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                월 *
              </label>
              <select
                value={formData.month}
                onChange={(e) =>
                  handleWeekChange(
                    formData.year,
                    parseInt(e.target.value),
                    1 // 월 변경 시 1주차로 리셋
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주차 *
              </label>
              <select
                value={formData.week}
                onChange={(e) =>
                  handleWeekChange(
                    formData.year,
                    formData.month,
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {getWeekOptions().map((w) => (
                  <option key={w} value={w}>
                    {w}주차
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            기간: {formData.weekStart} ~ {formData.weekEnd}
          </p>

          {/* 구분 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              구분 *
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  categoryId: e.target.value,
                  customer: '', // 구분 변경 시 고객사 초기화
                  item: '',
                  projectId: '',
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">-- 선택 --</option>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 보고 항목 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">보고 항목</h2>

          {/* 고객사 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              고객사 *
            </label>
            <select
              value={formData.customer}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  customer: e.target.value,
                  item: '', // 고객사 변경 시 ITEM 초기화
                  projectId: '',
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={!formData.categoryId}
            >
              <option value="">-- 선택 --</option>
              {filteredCustomers.map((cust) => (
                <option key={cust} value={cust}>
                  {cust}
                </option>
              ))}
            </select>
            {!formData.categoryId && (
              <p className="text-xs text-gray-400 mt-1">
                먼저 구분을 선택해주세요.
              </p>
            )}
          </div>

          {/* 개발 ITEM */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              개발 ITEM *
            </label>
            <select
              value={formData.item}
              onChange={(e) => {
                const selected = filteredItems.find(
                  (i) => i.item === e.target.value
                );
                setFormData((prev) => ({
                  ...prev,
                  item: e.target.value,
                  projectId: selected?.projectId || '',
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={!formData.customer}
            >
              <option value="">-- 선택 --</option>
              {filteredItems.map((i) => (
                <option key={i.item} value={i.item}>
                  {i.item}
                </option>
              ))}
            </select>
            {!formData.customer && (
              <p className="text-xs text-gray-400 mt-1">
                먼저 고객사를 선택해주세요.
              </p>
            )}
          </div>

          {/* 주요 추진 실적 및 계획 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              주요 추진 실적 및 계획 *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, content: e.target.value }))
              }
              rows={6}
              placeholder="■ 주요 추진 실적&#10;- 내용 1&#10;- 내용 2&#10;&#10;■ 차주 계획&#10;- 계획 1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* 업무일지 불러오기 버튼 */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            disabled={!formData.projectId}
            className={`px-4 py-2 border rounded-md transition-colors ${
              formData.projectId
                ? 'border-blue-500 text-blue-600 hover:bg-blue-50'
                : 'border-gray-300 text-gray-400 cursor-not-allowed'
            }`}
          >
            📝 업무일지에서 불러오기
          </button>
          {!formData.projectId && (
            <p className="text-xs text-gray-400 mt-1">
              먼저 개발 ITEM을 선택해주세요.
            </p>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>

        {/* 업무일지 불러오기 모달 */}
        {showImportModal && (
          <WorklogImportModal
            projectId={formData.projectId}
            weekStart={formData.weekStart}
            weekEnd={formData.weekEnd}
            onClose={() => setShowImportModal(false)}
            onImport={handleImportWorklogs}
          />
        )}
      </div>
    </AppLayout>
  );
}