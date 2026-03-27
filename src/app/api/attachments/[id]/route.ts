/**
 * 첨부파일 개별 API
 *
 * DELETE /api/attachments/[id] - 첨부파일 삭제
 *
 * 권한: 업로더 본인 또는 admin
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';
import { getById, deleteById, SHEET_NAMES } from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';

const BUCKET = 'attachments';

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

    const { id } = await params;

    // 첨부파일 조회
    const attachment = await getById<Record<string, unknown>>(SHEET_NAMES.ATTACHMENTS, id);
    if (!attachment) {
      return NextResponse.json(
        { success: false, error: '첨부파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 확인: 업로더 본인 또는 admin
    if (attachment.uploadedById !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // Storage에서 파일 삭제
    const storagePath = `${attachment.entityType}/${attachment.entityId}/${attachment.fileName}`;
    const supabase = getSupabase();
    await supabase.storage.from(BUCKET).remove([storagePath]);

    // DB에서 삭제
    await deleteById(SHEET_NAMES.ATTACHMENTS, id);

    return NextResponse.json({
      success: true,
      message: '첨부파일이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('첨부파일 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
