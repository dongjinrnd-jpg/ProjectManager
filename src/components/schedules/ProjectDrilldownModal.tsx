'use client';

/**
 * 프로젝트 드릴다운 모달
 *
 * Roadmap 2.13 기준:
 * - 간트차트에서 프로젝트 바 클릭 시 표시
 * - 프로젝트 기본 정보 및 진행 현황 표시
 * - 상세 페이지 이동 버튼
 */

import { useEffect, useRef } from 'react';
import type { GanttProject } from '@/app/api/schedules/gantt/route';

// 프로젝트 상태별 색상
const STATUS_COLORS: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-800',
  '보류': 'bg-amber-100 text-amber-800',
  '완료': 'bg-emerald-100 text-emerald-800',
};

// 단계별 색상
const STAGE_COLORS: Record<string, string> = {
  '견적': 'bg-gray-100 text-gray-800',
  '수주': 'bg-blue-100 text-blue-800',
  '설계': 'bg-purple-100 text-purple-800',
  '제작': 'bg-orange-100 text-orange-800',
  '납품': 'bg-green-100 text-green-800',
  'A/S': 'bg-red-100 text-red-800',
};

interface ProjectDrilldownModalProps {
  project: GanttProject | null;
  onClose: () => void;
  onNavigate: (projectId: string) => void;
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 일수 계산
 */
function calculateDays(startStr: string, endStr: string): number {
  const start = new Date(startStr);
  const end = new Date(endStr);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * 진행률 계산 (오늘 기준)
 */
function calculateProgress(startStr: string, endStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startStr);
  const end = new Date(endStr);

  if (today < start) return 0;
  if (today >= end) return 100;

  const total = end.getTime() - start.getTime();
  const elapsed = today.getTime() - start.getTime();
  return Math.round((elapsed / total) * 100);
}

export default function ProjectDrilldownModal({
  project,
  onClose,
  onNavigate,
}: ProjectDrilldownModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // 외부 클릭으로 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  if (!project) return null;

  const progress = calculateProgress(project.scheduleStart, project.scheduleEnd);
  const totalDays = calculateDays(project.scheduleStart, project.scheduleEnd);
  const statusClass = STATUS_COLORS[project.status] || STATUS_COLORS['진행중'];
  const stageClass = STAGE_COLORS[project.currentStage] || 'bg-gray-100 text-gray-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
      >
        {/* 헤더 */}
        <div className="bg-brand-primary text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {project.isFavorite && (
                <span className="text-yellow-300 text-xl">⭐</span>
              )}
              <h2 className="text-lg font-semibold">프로젝트 정보</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-4">
          {/* 고객사 / 프로젝트명 */}
          <div>
            <div className="text-sm text-gray-500">고객사</div>
            <div className="text-lg font-semibold text-gray-900">{project.customer}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">프로젝트명</div>
            <div className="text-lg font-semibold text-gray-900">{project.item}</div>
          </div>

          {/* 상태 및 단계 */}
          <div className="flex gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">상태</div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusClass}`}>
                {project.status}
              </span>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">현재 단계</div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${stageClass}`}>
                {project.currentStage}
              </span>
            </div>
          </div>

          {/* 소속/구분 */}
          <div className="flex gap-4">
            <div>
              <div className="text-sm text-gray-500">소속</div>
              <div className="text-gray-900">{project.division || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">구분</div>
              <div className="text-gray-900">{project.category || '-'}</div>
            </div>
          </div>

          {/* 일정 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-2">대일정</div>
            <div className="flex items-center justify-between text-gray-900">
              <span>{formatDate(project.scheduleStart)}</span>
              <span className="text-gray-400 mx-2">~</span>
              <span>{formatDate(project.scheduleEnd)}</span>
            </div>
            <div className="text-sm text-gray-500 mt-1 text-right">
              총 {totalDays}일
            </div>

            {/* 진행률 바 */}
            <div className="mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">진행률 (오늘 기준)</span>
                <span className="font-medium text-brand-primary">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            닫기
          </button>
          <button
            onClick={() => onNavigate(project.id)}
            className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-dark transition-colors"
          >
            상세 페이지 이동
          </button>
        </div>
      </div>
    </div>
  );
}