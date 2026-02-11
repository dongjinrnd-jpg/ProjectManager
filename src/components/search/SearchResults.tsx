'use client';

/**
 * 검색 결과 테이블 컴포넌트
 *
 * - 정렬 가능한 테이블 헤더
 * - 페이지네이션
 * - 결과 요약 (총 N건)
 */

import type { SearchResultItem, SearchSortField, SearchSortOption } from '@/types';

interface SearchResultsProps {
  results: SearchResultItem[];
  total: number;
  sort: SearchSortOption;
  onSortChange: (sort: SearchSortOption) => void;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

// 정렬 가능한 헤더
interface SortableHeaderProps {
  field: SearchSortField;
  label: string;
  currentSort: SearchSortOption;
  onSort: (field: SearchSortField) => void;
}

function SortableHeader({ field, label, currentSort, onSort }: SortableHeaderProps) {
  const isActive = currentSort.field === field;
  const icon = isActive ? (currentSort.order === 'asc' ? '↑' : '↓') : '↕';

  return (
    <th
      onClick={() => onSort(field)}
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
    >
      <span className="flex items-center gap-1">
        {label}
        <span className={isActive ? 'text-brand-orange' : 'text-gray-300'}>{icon}</span>
      </span>
    </th>
  );
}

export default function SearchResults({
  results,
  total,
  sort,
  onSortChange,
  page,
  pageSize,
  totalPages,
  onPageChange,
  isLoading,
}: SearchResultsProps) {
  // 정렬 핸들러
  const handleSort = (field: SearchSortField) => {
    if (sort.field === field) {
      // 같은 필드 클릭 시 순서 토글
      onSortChange({ field, order: sort.order === 'asc' ? 'desc' : 'asc' });
    } else {
      // 다른 필드 클릭 시 desc 기본
      onSortChange({ field, order: 'desc' });
    }
  };

  // 페이지 버튼 생성
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-primary">
            검색 결과: {total.toLocaleString()}건
          </h2>
          {total > 0 && (
            <span className="text-sm text-gray-500">
              {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} / {total}
            </span>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="date" label="날짜" currentSort={sort} onSort={handleSort} />
              <SortableHeader field="project" label="ITEM" currentSort={sort} onSort={handleSort} />
              <SortableHeader field="customer" label="고객사" currentSort={sort} onSort={handleSort} />
              <SortableHeader field="stage" label="단계" currentSort={sort} onSort={handleSort} />
              <SortableHeader field="assignee" label="담당자" currentSort={sort} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                업무내용
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  검색 중...
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              results.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                    {item.date}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <a
                      href={`/projects/${item.projectId}`}
                      className="text-brand-orange hover:underline"
                    >
                      {item.item}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {item.customer}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {item.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {item.assigneeName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                    <div className="truncate" title={item.content}>
                      {item.content}
                    </div>
                    {item.issue && (
                      <div className={`mt-1 text-xs ${item.issueStatus === 'resolved' ? 'text-green-600' : 'text-red-600'}`}>
                        ⚠️ {item.issue.slice(0, 50)}{item.issue.length > 50 ? '...' : ''}
                        {item.issueStatus === 'resolved' && ' (해결됨)'}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &lt;
          </button>

          {getPageNumbers().map((p, i) =>
            typeof p === 'number' ? (
              <button
                key={i}
                onClick={() => onPageChange(p)}
                className={`px-3 py-1 text-sm border rounded ${
                  p === page
                    ? 'bg-brand-orange text-white border-brand-orange'
                    : 'hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            ) : (
              <span key={i} className="px-2 text-gray-400">
                {p}
              </span>
            )
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  );
}
