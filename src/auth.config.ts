/**
 * NextAuth v5 기본 설정 (Edge 호환)
 *
 * 미들웨어에서 사용하기 위한 설정
 * Node.js 전용 모듈 없이 설정만 포함
 */

import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    // 인증 체크 - 미들웨어에서 호출
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      const isPublicApi =
        nextUrl.pathname.startsWith('/api/auth') ||
        nextUrl.pathname.startsWith('/api/health') ||
        nextUrl.pathname.startsWith('/api/setup');

      // 공개 API는 항상 허용
      if (isPublicApi) {
        return true;
      }

      // 로그인 페이지
      if (isOnLogin) {
        if (isLoggedIn) {
          // 이미 로그인된 경우 메인으로 리다이렉트
          return Response.redirect(new URL('/', nextUrl));
        }
        return true;
      }

      // 로그인 필요
      return isLoggedIn;
    },
  },
  providers: [], // auth.ts에서 추가
};
