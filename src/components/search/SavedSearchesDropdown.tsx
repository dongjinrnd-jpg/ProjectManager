'use client';

/**
 * 저장된 검색 드롭다운 컴포넌트
 *
 * - 저장된 검색 목록 표시
 * - 검색 조건 불러오기
 * - 삭제 기능
 */

import { useState, useRef, useEffect } from 'react';
import type { SavedSearchParsed } from '@/types';

interface SavedSearchesDropdownProps {
  savedSearches: SavedSearchParsed[];
  onSelect: (savedSearch: SavedSearchParsed) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

export default function SavedSearchesDropdown({
  savedSearches,
  onSelect,
  onDelete,
  isLoading,
}: SavedSearchesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 삭제 확인
  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (confirm(`"${name}" 검색 조건을 삭제하시겠습니까?`)) {
      onDelete(id);
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (savedSearches.length === 0) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        <span>📂</span>
        <span>저장된 검색</span>
        <span className="text-xs bg-brand-orange text-white px-1.5 py-0.5 rounded-full">
          {savedSearches.length}
        </span>
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2 border-b border-gray-100">
            <span className="text-xs text-gray-500">저장된 검색 조건</span>
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {savedSearches.map((ss) => (
              <li
                key={ss.id}
                onClick={() => {
                  onSelect(ss);
                  setIsOpen(false);
                }}
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer group"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {ss.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(ss.createdAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, ss.id, ss.name)}
                  className="ml-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="삭제"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
