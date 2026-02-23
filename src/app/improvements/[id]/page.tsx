/**
 * 개선요청 상세 페이지
 *
 * 개선요청 상세 정보, 처리 이력, 댓글 표시
 * 권한: engineer, admin, sysadmin
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ImprovementDetailClient from './ImprovementDetailClient';

interface ImprovementDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ImprovementDetailPage({ params }: ImprovementDetailPageProps) {
  const { id } = await params;

  // 인증 확인
  const session = await auth();
  if (!session) {
    redirect(`/login?callbackUrl=/improvements/${id}`);
  }

  // 권한 확인
  const allowedRoles = ['engineer', 'admin', 'sysadmin'];
  if (!allowedRoles.includes(session.user.role)) {
    redirect('/dashboard');
  }

  return <ImprovementDetailClient id={id} />;
}
