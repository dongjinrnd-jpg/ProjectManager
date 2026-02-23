/**
 * 매뉴얼 페이지
 *
 * 사용자 role에 맞는 매뉴얼 표시
 * 모든 권한 접근 가능
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ManualClient from './ManualClient';

export default async function ManualPage() {
  // 인증 확인
  const session = await auth();
  if (!session) {
    redirect('/login?callbackUrl=/manual');
  }

  return <ManualClient />;
}
