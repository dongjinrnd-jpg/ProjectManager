/**
 * NextAuth v5 설정
 *
 * Credentials Provider를 사용한 자체 로그인 시스템
 * Users 시트 기반 인증
 */

import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { findRowByColumn, SHEET_NAMES } from '@/lib/google';
import type { UserRole } from '@/types';
import { authConfig } from './auth.config';

// Google Sheets에서 가져온 사용자 데이터 타입
interface SheetUser {
  [key: string]: unknown;
  id: string;
  password: string;
  name: string;
  email: string;
  role: UserRole;
  division: string;
  isActive: string | boolean;
  createdAt: string;
  updatedAt: string;
}

// 세션에 포함될 사용자 정보 타입 확장
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      division: string;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
    division: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        id: { label: '아이디', type: 'text' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        try {
          // 입력값 검증
          if (!credentials?.id || !credentials?.password) {
            return null;
          }

          const userId = credentials.id as string;
          const password = credentials.password as string;

          // Users 시트에서 사용자 찾기
          const result = await findRowByColumn<SheetUser>(
            SHEET_NAMES.USERS,
            'id',
            userId
          );

          if (!result) {
            return null;
          }

          const user = result.data;

          // 비활성화된 사용자 체크
          const isActive =
            user.isActive === true ||
            user.isActive === 'TRUE' ||
            user.isActive === 'true';
          if (!isActive) {
            return null;
          }

          // 비밀번호 검증
          const isValidPassword = await bcrypt.compare(password, user.password);

          if (!isValidPassword) {
            return null;
          }

          // 인증 성공 - 사용자 정보 반환
          return {
            id: user.id,
            name: user.name,
            email: user.email || '',
            role: user.role,
            division: user.division,
          };
        } catch (error) {
          console.error('인증 오류:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // JWT 토큰에 사용자 정보 추가
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.division = user.division;
      }
      return token;
    },
    // 세션에 사용자 정보 추가
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.division = token.division as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24시간
  },
  secret: process.env.AUTH_SECRET,
});
