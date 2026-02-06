'use client';

/**
 * NextAuth SessionProvider 래퍼
 * 클라이언트 컴포넌트로 분리하여 서버 컴포넌트인 레이아웃에서 사용
 */

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}