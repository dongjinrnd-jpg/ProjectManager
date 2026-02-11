'use client';

/**
 * 고급 검색 클라이언트 컴포넌트
 *
 * - 검색 조건 폼
 * - 검색 결과 테이블
 * - 저장된 검색 관리
 */

import { useState, useEffect, useCallback } from 'react';
import {
  SearchFilters,
  SearchResults,
  SavedSearchesDropdown,
} from '@/components/search';
import type {
  AdvancedSearchFilter,
  SearchResultItem,
  SearchSortOption,
  SavedSearchParsed,
  Project,
  User,
} from '@/types';

export default function SearchClient() {
  // 필터 상태
  const [filters, setFilters] = useState<AdvancedSearchFilter>({
    keywordScope: { content: true, issue: true },
  });

  // 정렬 상태
  const [sort, setSort] = useState<SearchSortOption>({ field: 'date', order: 'desc' });

  // 페이지네이션 상태
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 검색 결과 상태
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 저장된 검색 상태
  const [savedSearches, setSavedSearches] = useState<SavedSearchParsed[]>([]);

  // 마스터 데이터
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [projectsRes, usersRes, savedRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/users'),
          fetch('/api/saved-searches'),
        ]);

        if (projectsRes.ok) {
          const data = await projectsRes.json();
          setProjects(data.data || []);
        }

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.data || []);
        }

        if (savedRes.ok) {
          const data = await savedRes.json();
          setSavedSearches(data.data || []);
        }
      } catch (error) {
        console.error('초기 데이터 로드 오류:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadInitialData();
  }, []);

  // 검색 실행
  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      // 필터 파라미터 추가
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.customer) params.set('customer', filters.customer);
      if (filters.division) params.set('division', filters.division);
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
      if (filters.status) params.set('status', filters.status);
      if (filters.keyword) params.set('keyword', filters.keyword);

      // 키워드 검색 범위
      if (filters.keywordScope) {
        const scope = [];
        if (filters.keywordScope.content) scope.push('content');
        if (filters.keywordScope.issue) scope.push('issue');
        if (scope.length > 0) params.set('keywordScope', scope.join(','));
      }

      // 정렬 파라미터
      params.set('sortBy', sort.field);
      params.set('sortOrder', sort.order);

      // 페이지네이션
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setResults(data.data.items);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      } else {
        alert(data.error || '검색 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('검색 오류:', error);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, sort, page, pageSize]);

  // 필터 초기화
  const handleReset = () => {
    setFilters({
      keywordScope: { content: true, issue: true },
    });
    setSort({ field: 'date', order: 'desc' });
    setPage(1);
    setResults([]);
    setTotal(0);
    setTotalPages(0);
  };

  // 검색 조건 저장
  const handleSave = async () => {
    const name = prompt('검색 조건 이름을 입력하세요:');
    if (!name) return;

    try {
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters }),
      });

      const data = await response.json();
      if (data.success) {
        setSavedSearches([data.data, ...savedSearches]);
        alert('검색 조건이 저장되었습니다.');
      } else {
        alert(data.error || '저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 저장된 검색 불러오기
  const handleSelectSavedSearch = (savedSearch: SavedSearchParsed) => {
    setFilters({
      ...savedSearch.filters,
      keywordScope: savedSearch.filters.keywordScope || { content: true, issue: true },
    });
    setPage(1);
    // 검색은 자동으로 실행하지 않음 (사용자가 검색 버튼 클릭)
  };

  // 저장된 검색 삭제
  const handleDeleteSavedSearch = async (id: string) => {
    try {
      const response = await fetch(`/api/saved-searches/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setSavedSearches(savedSearches.filter((ss) => ss.id !== id));
      } else {
        alert(data.error || '삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 정렬 변경 시 검색 재실행
  const handleSortChange = (newSort: SearchSortOption) => {
    setSort(newSort);
    setPage(1);
  };

  // 페이지 변경 시 검색 재실행
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // 정렬/페이지 변경 시 자동 검색 (결과가 있을 때만)
  useEffect(() => {
    if (total > 0) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, page]);

  if (!isInitialized) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-primary">🔍 고급 검색</h1>
        <SavedSearchesDropdown
          savedSearches={savedSearches}
          onSelect={handleSelectSavedSearch}
          onDelete={handleDeleteSavedSearch}
          isLoading={isLoading}
        />
      </div>

      {/* 검색 필터 */}
      <SearchFilters
        filters={filters}
        onFilterChange={setFilters}
        onSearch={handleSearch}
        onReset={handleReset}
        onSave={handleSave}
        projects={projects}
        users={users}
        isLoading={isLoading}
      />

      {/* 검색 결과 */}
      <SearchResults
        results={results}
        total={total}
        sort={sort}
        onSortChange={handleSortChange}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        isLoading={isLoading}
      />
    </div>
  );
}
