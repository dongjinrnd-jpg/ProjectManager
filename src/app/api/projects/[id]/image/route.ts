/**
 * 프로젝트 제품 이미지 API
 *
 * POST /api/projects/[id]/image - 이미지 업로드
 * DELETE /api/projects/[id]/image - 이미지 삭제
 *
 * 권한: 팀장, 팀원, admin
 * 저장소: Supabase Storage (product-images 버킷)
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';
import { findRowByColumn, updateById, SHEET_NAMES } from '@/lib/supabase/db';
import { getSession, isAdmin } from '@/lib/auth';
import type { UserRole } from '@/types';

const BUCKET = 'product-images';

/**
 * 프로젝트 접근 권한 확인 (팀장, 팀원, admin)
 */
async function checkAccess(projectId: string, userId: string, userRole: UserRole) {
  const result = await findRowByColumn<Record<string, unknown>>(
    SHEET_NAMES.PROJECTS,
    'id',
    projectId
  );

  if (!result) return { allowed: false, error: '프로젝트를 찾을 수 없습니다.', status: 404 };

  const project = result.data;
  const isTeamMember =
    project.teamLeaderId === userId ||
    ((project.teamMembers as string) || '').split(',').includes(userId);

  if (!isTeamMember && !isAdmin(userRole)) {
    return { allowed: false, error: '이미지 변경 권한이 없습니다.', status: 403 };
  }

  return { allowed: true, project };
}

/**
 * POST /api/projects/[id]/image
 * 제품 이미지 업로드
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const access = await checkAccess(projectId, session.user.id, session.user.role as UserRole);
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    // FormData에서 파일 추출
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 5MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const filePath = `${projectId}.jpg`;

    // 기존 이미지 삭제 (덮어쓰기)
    await supabase.storage.from(BUCKET).remove([filePath]);

    // 업로드
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
    }

    // 공개 URL 생성
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // DB 업데이트
    await updateById(SHEET_NAMES.PROJECTS, projectId, {
      productImageUrl: imageUrl,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: { imageUrl },
      message: '이미지가 업로드되었습니다.',
    });
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/image
 * 제품 이미지 삭제
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const access = await checkAccess(projectId, session.user.id, session.user.role as UserRole);
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    const supabase = getSupabase();
    const filePath = `${projectId}.jpg`;

    // Storage에서 삭제
    await supabase.storage.from(BUCKET).remove([filePath]);

    // DB 업데이트
    await updateById(SHEET_NAMES.PROJECTS, projectId, {
      productImageUrl: null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: '이미지가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('이미지 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
