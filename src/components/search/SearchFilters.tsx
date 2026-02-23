'use client';

/**
 * 고급 검색 필터 컴포넌트
 *
 * Roadmap 2.14 UI 디자인 준수:
 * - 날짜 범위, 고객사, 소속, 단계, 담당자, 진행여부
 * - 키워드 + 검색 범위 체크박스
 * - [검색], [초기화], [저장] 버튼
 */

import { useState } from 'react';
import type { AdvancedSearchFilter, KeywordScope, ProjectStage, ProjectStatus, User, Project } from '@/types';

const STAGES: ProjectStage[] = [
  '검토', '설계', '개발', 'PROTO', '신뢰성', 'P1', 'P2', '승인',
  '양산이관', '초도양산', '품질관리', '원가절감', '품질개선', '설계변경'
];

const DIVISIONS = ['전장', '유압', '기타'];
const STATUSES: ProjectStatus[] = ['진행중', '보류', '완료'];

interface SearchFiltersProps {
  filters: AdvancedSearchFilter;
  onFilterChange: (filters: AdvancedSearchFilter) => void;
  onSearch: () => void;
  onReset: () => void;
  onSave: () => void;
  projects: Project[];
  users: User[];
  isLoading: boolean;
}

export default function SearchFilters({
  filters,
  onFilterChange,
  onSearch,
  onReset,
  onSave,
  projects,
  users,
  isLoading,
}: SearchFiltersProps) {
  // 키워드 검색 범위 상태
  const [keywordScope, setKeywordScope] = useState<KeywordScope>(
    filters.keywordScope || { content: true, issue: true }
  );

  // 필터 값 변경 핸들러
  const handleChange = (field: keyof AdvancedSearchFilter, value: string) => {
    onFilterChange({
      ...filters,
      [field]: value || undefined,
    });
  };

  // 키워드 범위 변경 핸들러
  const handleScopeChange = (field: keyof KeywordScope, checked: boolean) => {
    const newScope = { ...keywordScope, [field]: checked };
    setKeywordScope(newScope);
    onFilterChange({
      ...filters,
      keywordScope: newScope,
    });
  };

  // 고유한 고객사 목록 추출
  const customers = [...new Set(projects.map((p) => p.customer))].sort();

  // Enter 키 검색
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-brand-primary mb-4">검색 조건</h2>

      {/* 필터 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {/* 날짜 범위 */}
        <div className="lg:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">날짜 범위</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleChange('startDate', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
            />
            <span className="text-gray-500">~</span>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleChange('endDate', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
            />
          </div>
        </div>

        {/* 고객사 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">고객사</label>
          <select
            value={filters.customer || ''}
            onChange={(e) => handleChange('customer', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
          >
            <option value="">전체</option>
            {customers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* 소속 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">소속</label>
          <select
            value={filters.division || ''}
            onChange={(e) => handleChange('division', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
          >
            <option value="">전체</option>
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* 단계 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">단계</label>
          <select
            value={filters.stage || ''}
            onChange={(e) => handleChange('stage', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
          >
            <option value="">전체</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* 담당자 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">담당자</label>
          <select
            value={filters.assigneeId || ''}
            onChange={(e) => handleChange('assigneeId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
          >
            <option value="">전체</option>
            {users
              .filter((u) => u.isActive && u.role !== 'sysadmin')
              .map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
          </select>
        </div>

        {/* 진행여부 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">진행여부</label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
          >
            <option value="">전체</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 키워드 검색 */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">키워드</label>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={filters.keyword || ''}
              onChange={(e) => handleChange('keyword', e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="업무내용, 이슈사항 검색..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={keywordScope.content}
                onChange={(e) => handleScopeChange('content', e.target.checked)}
                className="w-4 h-4 text-brand-orange border-gray-300 rounded focus:ring-brand-orange"
              />
              업무진행사항
            </label>
            <label className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={keywordScope.issue}
                onChange={(e) => handleScopeChange('issue', e.target.checked)}
                className="w-4 h-4 text-brand-orange border-gray-300 rounded focus:ring-brand-orange"
              />
              이슈사항
            </label>
          </div>
        </div>
      </div>

      {/* 버튼 영역 */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onReset}
          disabled={isLoading}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
        >
          초기화
        </button>
        <button
          onClick={onSave}
          disabled={isLoading}
          className="px-4 py-2 text-sm text-brand-orange border border-brand-orange hover:bg-brand-orange-light rounded-md transition-colors"
        >
          ⭐ 저장
        </button>
        <button
          onClick={onSearch}
          disabled={isLoading}
          className="px-4 py-2 text-sm bg-brand-orange text-white hover:opacity-90 rounded-md transition-colors disabled:opacity-50"
        >
          {isLoading ? '검색 중...' : '🔍 검색'}
        </button>
      </div>
    </div>
  );
}
