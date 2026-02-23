'use client';

/**
 * 매뉴얼 클라이언트 컴포넌트
 *
 * Markdown 형식의 매뉴얼을 렌더링
 */

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import AppLayout from '@/components/layout/AppLayout';

// 역할 라벨
const ROLE_LABELS: Record<string, string> = {
  user: '일반 사용자',
  engineer: '엔지니어',
  admin: '관리자',
  executive: '경영진',
  sysadmin: '시스템 관리자',
};

export default function ManualClient() {
  const [content, setContent] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManual = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/manual');
        const data = await response.json();

        if (data.success) {
          setContent(data.data.content);
          setRole(data.data.role);
          setError(null);
        } else {
          setError(data.error || '매뉴얼을 불러올 수 없습니다.');
        }
      } catch (err) {
        setError('서버 연결 오류가 발생했습니다.');
        console.error('매뉴얼 조회 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchManual();
  }, []);

  return (
    <AppLayout>
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📖</span> 사용자 매뉴얼
          {role && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({ROLE_LABELS[role] || role})
            </span>
          )}
        </h1>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 로딩 */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          로딩 중...
        </div>
      ) : (
        /* 매뉴얼 콘텐츠 */
        <div className="bg-white rounded-lg shadow p-6 md:p-8">
          <article className="prose prose-sm md:prose-base max-w-none text-black prose-headings:text-black prose-p:text-black prose-li:text-black prose-strong:text-black prose-h1:text-2xl prose-h1:border-b prose-h1:pb-2 prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-table:text-sm prose-th:bg-gray-100 prose-th:p-2 prose-th:text-black prose-td:p-2 prose-td:border prose-td:text-black prose-th:border prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:text-xs prose-pre:overflow-x-auto prose-code:text-brand-orange prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-brand-orange prose-blockquote:bg-orange-50 prose-blockquote:py-1 prose-blockquote:text-black prose-a:text-brand-orange prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {content}
            </ReactMarkdown>
          </article>
        </div>
      )}
    </AppLayout>
  );
}
