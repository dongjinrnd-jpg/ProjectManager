/**
 * NextAuth 미들웨어 (Edge 호환)
 *
 * 인증이 필요한 페이지 보호
 * - 미인증 사용자 → 로그인 페이지로 리다이렉트
 *
 * 주의: Edge runtime에서 실행되므로 Node.js 모듈 사용 불가
 * auth.config.ts의 설정만 사용
 */

import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

// 미들웨어 적용 경로 설정
export const config = {
  matcher: [
    /*
     * 다음 경로를 제외한 모든 경로에 적용:
     * - api/auth (NextAuth API)
     * - api/health (상태 체크)
     * - api/setup (초기 설정)
     * - login (로그인 페이지)
     * - _next (Next.js 내부)
     * - favicon, 이미지 등 정적 파일
     */
    '/((?!api/auth|api/health|api/setup|login|_next|favicon.ico|.*\\.).*)',
  ],
};
