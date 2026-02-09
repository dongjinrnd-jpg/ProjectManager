'use client';

/**
 * 업무일지 불러오기 모달
 *
 * Roadmap 2.22 기준
 * - 해당 기간 업무일지 목록 표시
 * - 체크박스로 선택
 * - 선택한 내용을 주간보고 내용에 반영
 */

import { useState, useEffect, useCallback } from 'react';
import type { WorkLog } from '@/types';

interface WorklogImportModalProps {
  projectId: string;
  weekStart: string;
  weekEnd: string;
  onClose: () => void;
  onImport: (content: string) => void;
}

export default function WorklogImportModal({
  projectId,
  weekStart,
  weekEnd,
  onClose,
  onImport,
}: WorklogImportModalProps) {
  const [worklogs, setWorklogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 업무일지 조회
  const fetchWorklogs = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        projectId,
        startDate: weekStart,
        endDate: weekEnd,
      });

      const response = await fetch(`/api/worklogs?${params}`);
      const data = await response.json();

      if (data.success) {
        setWorklogs(data.data);
        // 기본적으로 모두 선택
        setSelectedIds(new Set(data.data.map((w: WorkLog) => w.id)));
      }
    } catch (err) {
      console.error('업무일지 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, weekStart, weekEnd]);

  useEffect(() => {
    fetchWorklogs();
  }, [fetchWorklogs]);

  // 체크박스 토글
  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 전체 선택
  const handleSelectAll = () => {
    setSelectedIds(new Set(worklogs.map((w) => w.id)));
  };

  // 전체 해제
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // 불러오기
  const handleImport = () => {
    const selectedWorklogs = worklogs.filter((w) => selectedIds.has(w.id));

    // 날짜별로 정렬
    selectedWorklogs.sort((a, b) => a.date.localeCompare(b.date));

    // 내용 포맷팅
    const content = selectedWorklogs
      .map((w) => {
        const dateStr = w.date.split('-').slice(1).join('/'); // MM/DD
        return `■ ${dateStr} ${w.stage}\n${w.content}`;
      })
      .join('\n\n');

    onImport(content);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">📝 업무일지에서 불러오기</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* 정보 */}
        <div className="px-4 py-2 bg-gray-50 border-b">
          <p className="text-sm text-gray-600">
            기간: {weekStart} ~ {weekEnd}
          </p>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
            </div>
          ) : worklogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              해당 기간에 등록된 업무일지가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {worklogs.map((worklog) => (
                <label
                  key={worklog.id}
                  className={`block p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedIds.has(worklog.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(worklog.id)}
                      onChange={() => handleToggle(worklog.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">
                        {worklog.date} ({worklog.assigneeId})
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        {worklog.stage}
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {worklog.content}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              전체 해제
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50"
            >
              선택 항목 불러오기 ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}