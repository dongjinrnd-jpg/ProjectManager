/**
 * 루트 페이지
 *
 * 로그인 상태에 따라 리다이렉트
 * - 로그인: /dashboard
 * - 비로그인: /login
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}