'use client';

/**
 * 로그인 폼 컴포넌트
 *
 * 클라이언트 컴포넌트 - 폼 상태 관리
 */

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface LoginFormProps {
  callbackUrl: string;
}

export default function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const id = formData.get('id') as string;
    const password = formData.get('password') as string;

    try {
      const result = await signIn('credentials', {
        id,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        setIsLoading(false);
        return;
      }

      // 로그인 성공 - 리다이렉트
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 아이디 입력 */}
      <div>
        <label
          htmlFor="id"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          아이디
        </label>
        <input
          id="id"
          name="id"
          type="text"
          required
          autoComplete="username"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange
                     disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="아이디를 입력하세요"
          disabled={isLoading}
        />
      </div>

      {/* 비밀번호 입력 */}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange
                     disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="비밀번호를 입력하세요"
          disabled={isLoading}
        />
      </div>

      {/* 로그인 버튼 */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-brand-primary text-white font-medium rounded-md
                   hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2
                   disabled:opacity-60 disabled:cursor-not-allowed
                   transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            로그인 중...
          </span>
        ) : (
          '로그인'
        )}
      </button>
    </form>
  );
}
