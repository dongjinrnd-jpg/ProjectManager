/**
 * 개선요청 수정 페이지
 *
 * 기존 개선요청을 수정
 * 권한: 작성자 또는 sysadmin
 */

import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { findRowByColumn, SHEET_NAMES } from '@/lib/google';
import ImprovementFormClient from '../../ImprovementFormClient';
import type {
  Improvement,
  ImprovementType,
  ImprovementStatus,
  ImprovementPriority,
  RelatedMenu,
} from '@/types/improvement';

interface EditImprovementPageProps {
  params: Promise<{ id: string }>;
}

// 시트에서 가져온 개선요청 타입
interface SheetImprovement extends Record<string, unknown> {
  id: string;
  title: string;
  type: ImprovementType;
  status: ImprovementStatus;
  priority: ImprovementPriority;
  content: string;
  relatedMenu: RelatedMenu;
  reproductionSteps: string;
  screenshotUrl: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  completedAt: string;
}

export default async function EditImprovementPage({ params }: EditImprovementPageProps) {
  const { id } = await params;

  // 인증 확인
  const session = await auth();
  if (!session) {
    redirect(`/login?callbackUrl=/improvements/${id}/edit`);
  }

  // 권한 확인
  const allowedRoles = ['engineer', 'admin', 'sysadmin'];
  if (!allowedRoles.includes(session.user.role)) {
    redirect('/dashboard');
  }

  // 개선요청 직접 조회
  const result = await findRowByColumn<SheetImprovement>(
    SHEET_NAMES.IMPROVEMENTS,
    'id',
    id
  );

  if (!result) {
    notFound();
  }

  const improvement = result.data as Improvement;

  // 수정 권한 확인 (작성자 또는 sysadmin)
  if (improvement.authorId !== session.user.id && session.user.role !== 'sysadmin') {
    redirect(`/improvements/${id}`);
  }

  return <ImprovementFormClient improvement={improvement} />;
}
