'use client';

/**
 * 개선요청 목록 클라이언트 컴포넌트
 *
 * Roadmap 2.29 기준
 * - 개선요청 목록 테이블
 * - 상태/유형/우선순위 필터링
 * - 키워드 검색
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  ImprovementListItem,
  IMPROVEMENT_TYPE_LABELS,
  IMPROVEMENT_STATUS_LABELS,
  IMPROVEMENT_PRIORITY_LABELS,
} from '@/types/improvement';
import AppLayout from '@/components/layout/AppLayout';

// 유형 레이블
const TYPE_LABELS: typeof IMPROVEMENT_TYPE_LABELS = {
  bug: { label: '버그', icon: '🐛' },
  improvement: { label: '개선요청', icon: '💡' },
  feature: { label: '기능추가', icon: '✨' },
  other: { label: '기타', icon: '📝' },
};

// 상태 레이블
const STATUS_LABELS: typeof IMPROVEMENT_STATUS_LABELS = {
  submitted: { label: '접수', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  reviewing: { label: '검토중', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  in_progress: { label: '진행중', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  completed: { label: '완료', color: 'text-green-700', bgColor: 'bg-green-100' },
  hold: { label: '보류', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  rejected: { label: '반려', color: 'text-red-700', bgColor: 'bg-red-100' },
};

// 우선순위 레이블
const PRIORITY_LABELS: typeof IMPROVEMENT_PRIORITY_LABELS = {
  urgent: { label: '긴급', color: 'text-red-700', bgColor: 'bg-red-100' },
  high: { label: '높음', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  normal: { label: '보통', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  low: { label: '낮음', color: 'text-green-700', bgColor: 'bg-green-100' },
};

export default function ImprovementsClient() {
  const [improvements, setImprovements] = useState<ImprovementListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // 개선요청 목록 가져오기
  const fetchImprovements = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('keyword', searchQuery);
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);
      if (filterPriority) params.set('priority', filterPriority);

      const response = await fetch(`/api/improvements?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setImprovements(data.data);
        setError(null);
      } else {
        setError(data.error || '목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('개선요청 목록 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterStatus, filterType, filterPriority]);

  useEffect(() => {
    fetchImprovements();
  }, [fetchImprovements]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(improvements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = improvements.slice(startIndex, startIndex + itemsPerPage);

  // 페이지 변경 시 첫 페이지로 리셋 (필터 변경 시)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterType, filterPriority]);

  // 페이지 번호 생성 (최대 5개 표시)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📋</span> 개선요청 게시판
        </h1>
        <Link
          href="/improvements/new"
          className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 transition-colors"
        >
          + 새 요청
        </Link>
      </div>

      {/* 필터 영역 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* 상태 필터 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABELS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* 유형 필터 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value="">전체 유형</option>
            {Object.entries(TYPE_LABELS).map(([value, { label, icon }]) => (
              <option key={value} value={value}>{icon} {label}</option>
            ))}
          </select>

          {/* 우선순위 필터 */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value="">전체 우선순위</option>
            {Object.entries(PRIORITY_LABELS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* 검색 */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="제목, 내용 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : improvements.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            등록된 개선요청이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    유형
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    우선순위
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[300px]">
                    제목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작성자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작성일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    처리예정일
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      <Link
                        href={`/improvements/${item.id}`}
                        className="text-brand-orange hover:underline"
                      >
                        {item.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_LABELS[item.status].bgColor} ${STATUS_LABELS[item.status].color}`}>
                        {STATUS_LABELS[item.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center gap-1">
                        {TYPE_LABELS[item.type].icon}
                        {TYPE_LABELS[item.type].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${PRIORITY_LABELS[item.priority].bgColor} ${PRIORITY_LABELS[item.priority].color}`}>
                        {PRIORITY_LABELS[item.priority].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <Link
                        href={`/improvements/${item.id}`}
                        className="hover:text-brand-orange hover:underline"
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.authorName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.dueDate || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          총 {improvements.length}건
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lt;
            </button>
            {getPageNumbers().map((page, idx) => (
              typeof page === 'number' ? (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 text-sm border rounded ${
                    currentPage === page
                      ? 'bg-brand-orange text-white border-brand-orange'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ) : (
                <span key={idx} className="px-2 text-gray-400">...</span>
              )
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &gt;
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
