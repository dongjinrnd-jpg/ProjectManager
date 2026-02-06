/**
 * 로그인 페이지
 *
 * ID/Password 기반 자체 로그인
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import LoginForm from './LoginForm';

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // 이미 로그인된 사용자는 메인 페이지로 리다이렉트
  const session = await auth();
  if (session) {
    redirect('/');
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl || '/';
  const error = params.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-brand-yellow"></div>
                <div className="w-3 h-3 rounded-full bg-brand-orange"></div>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-brand-primary">
              프로젝트 관리 시스템
            </h1>
            <p className="text-gray-600 mt-2">로그인하여 시작하세요</p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">
                {error === 'CredentialsSignin'
                  ? '아이디 또는 비밀번호가 올바르지 않습니다.'
                  : '로그인 중 오류가 발생했습니다.'}
              </p>
            </div>
          )}

          {/* 로그인 폼 */}
          <LoginForm callbackUrl={callbackUrl} />

          {/* 하단 안내 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              계정이 없으신가요? 관리자에게 문의하세요.
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <p className="text-center text-brand-primary/50 text-sm mt-4">
          DONGJIN 연구개발 프로젝트 관리 시스템
        </p>
      </div>
    </div>
  );
}
