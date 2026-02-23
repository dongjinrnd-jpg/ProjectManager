'use client';

/**
 * 개선요청 등록/수정 폼 컴포넌트
 *
 * Roadmap 2.30 기준
 * - 필수: 제목, 유형, 내용
 * - 선택: 관련 메뉴, 우선순위, 재현 방법, 스크린샷 URL
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Improvement,
  ImprovementType,
  ImprovementPriority,
  RelatedMenu,
  CreateImprovementInput,
  UpdateImprovementInput,
} from '@/types/improvement';
import AppLayout from '@/components/layout/AppLayout';

// 유형 목록
const TYPES: { value: ImprovementType; label: string; icon: string }[] = [
  { value: 'bug', label: '버그', icon: '🐛' },
  { value: 'improvement', label: '개선요청', icon: '💡' },
  { value: 'feature', label: '기능추가', icon: '✨' },
  { value: 'other', label: '기타', icon: '📝' },
];

// 우선순위 목록
const PRIORITIES: { value: ImprovementPriority; label: string }[] = [
  { value: 'urgent', label: '긴급' },
  { value: 'high', label: '높음' },
  { value: 'normal', label: '보통' },
  { value: 'low', label: '낮음' },
];

// 관련 메뉴 목록
const MENUS: { value: RelatedMenu; label: string }[] = [
  { value: 'dashboard', label: '대시보드' },
  { value: 'projects', label: '프로젝트' },
  { value: 'worklogs', label: '업무일지' },
  { value: 'weekly', label: '주간보고' },
  { value: 'schedules', label: '일정' },
  { value: 'search', label: '검색' },
  { value: 'settings', label: '설정' },
  { value: 'other', label: '기타' },
];

interface ImprovementFormClientProps {
  improvement?: Improvement;
}

export default function ImprovementFormClient({ improvement }: ImprovementFormClientProps) {
  const router = useRouter();
  const isEdit = !!improvement;

  // 폼 상태
  const [title, setTitle] = useState(improvement?.title || '');
  const [type, setType] = useState<ImprovementType>(improvement?.type || 'improvement');
  const [content, setContent] = useState(improvement?.content || '');
  const [relatedMenu, setRelatedMenu] = useState<RelatedMenu>(improvement?.relatedMenu || 'other');
  const [priority, setPriority] = useState<ImprovementPriority>(improvement?.priority || 'normal');
  const [reproductionSteps, setReproductionSteps] = useState(improvement?.reproductionSteps || '');
  const [screenshotUrl, setScreenshotUrl] = useState(improvement?.screenshotUrl || '');

  // UI 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 버그 유형일 때만 재현 방법 표시
  const showReproductionSteps = type === 'bug';

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 필수 필드 검증
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      setError('내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreateImprovementInput | UpdateImprovementInput = {
        title: title.trim(),
        type,
        content: content.trim(),
        relatedMenu,
        priority,
        reproductionSteps: reproductionSteps.trim(),
        screenshotUrl: screenshotUrl.trim(),
      };

      const url = isEdit ? `/api/improvements/${improvement.id}` : '/api/improvements';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        // 성공 시 목록 또는 상세 페이지로 이동
        if (isEdit) {
          router.push(`/improvements/${improvement.id}`);
        } else {
          router.push('/improvements');
        }
      } else {
        setError(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
      console.error('개선요청 저장 오류:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📝</span> {isEdit ? '개선요청 수정' : '개선요청 등록'}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            form="improvement-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-brand-orange text-white rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 폼 */}
      <form id="improvement-form" onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          {/* 제목 */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="개선요청 제목을 입력하세요 (최대 100자)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              required
            />
            <div className="mt-1 text-xs text-gray-500 text-right">{title.length}/100</div>
          </div>

          {/* 유형, 관련 메뉴, 우선순위 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                유형 <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as ImprovementType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              >
                {TYPES.map(({ value, label, icon }) => (
                  <option key={value} value={value}>
                    {icon} {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="relatedMenu" className="block text-sm font-medium text-gray-700 mb-1">
                관련 메뉴
              </label>
              <select
                id="relatedMenu"
                value={relatedMenu}
                onChange={(e) => setRelatedMenu(e.target.value as RelatedMenu)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              >
                {MENUS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                우선순위
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as ImprovementPriority)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
              >
                {PRIORITIES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 내용 */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="개선요청 내용을 상세히 입력하세요..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900 resize-y"
              required
            />
          </div>

          {/* 재현 방법 (버그인 경우) */}
          {showReproductionSteps && (
            <div>
              <label htmlFor="reproductionSteps" className="block text-sm font-medium text-gray-700 mb-1">
                재현 방법
              </label>
              <textarea
                id="reproductionSteps"
                value={reproductionSteps}
                onChange={(e) => setReproductionSteps(e.target.value)}
                rows={4}
                placeholder="버그를 재현하는 방법을 단계별로 입력하세요...&#10;1. ...&#10;2. ...&#10;3. ..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900 resize-y"
              />
            </div>
          )}

          {/* 스크린샷 URL */}
          <div>
            <label htmlFor="screenshotUrl" className="block text-sm font-medium text-gray-700 mb-1">
              스크린샷 URL
            </label>
            <input
              type="url"
              id="screenshotUrl"
              value={screenshotUrl}
              onChange={(e) => setScreenshotUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">
              이미지 URL을 입력하세요. (추후 파일 업로드 기능 추가 예정)
            </p>
          </div>
        </div>
      </form>
    </AppLayout>
  );
}
