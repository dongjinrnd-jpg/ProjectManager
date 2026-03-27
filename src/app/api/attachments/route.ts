/**
 * 첨부파일 API Routes
 *
 * GET /api/attachments - 첨부파일 목록 조회
 * POST /api/attachments - 첨부파일 업로드 (PDF만)
 *
 * 권한: 로그인 필수, 업로드는 engineer/admin
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';
import { query, getAllAsObjects, insertRow, SHEET_NAMES } from '@/lib/supabase/db';
import { getSession } from '@/lib/auth';
import type { AttachmentEntityType } from '@/types';

const BUCKET = 'attachments';

/**
 * 새 첨부파일 ID 생성
 */
async function generateAttachmentId(): Promise<string> {
  const allItems = await getAllAsObjects<{ id: string }>(SHEET_NAMES.ATTACHMENTS);
  const prefix = 'ATT-';
  let maxNum = 0;
  for (const item of allItems) {
    if (item.id && item.id.startsWith(prefix)) {
      const num = parseInt(item.id.replace(prefix, ''), 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(5, '0')}`;
}

/**
 * GET /api/attachments
 * 첨부파일 목록 조회
 *
 * ?entityType=worklog&entityId=WL-xxx  → 특정 업무일지의 첨부파일
 * ?entityType=worklog&projectId=PRJ-xxx → 프로젝트의 모든 업무일지 첨부파일
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType') as AttachmentEntityType | null;
    const entityId = searchParams.get('entityId') || '';
    const projectId = searchParams.get('projectId') || '';

    // 특정 엔티티의 첨부파일
    if (entityType && entityId) {
      const attachments = await query<Record<string, unknown>>(SHEET_NAMES.ATTACHMENTS, {
        filters: [
          { column: 'entityType', op: 'eq', value: entityType },
          { column: 'entityId', op: 'eq', value: entityId },
        ],
        orderBy: { column: 'createdAt', ascending: false },
      });

      return NextResponse.json({ success: true, data: attachments });
    }

    // 프로젝트의 모든 업무일지 첨부파일
    if (projectId) {
      // 해당 프로젝트의 업무일지 ID 목록 조회
      const worklogs = await query<Record<string, unknown>>(SHEET_NAMES.WORKLOGS, {
        filters: [{ column: 'projectId', op: 'eq', value: projectId }],
        select: 'id,date,stage,assignee_id',
      });

      const worklogIds = worklogs.map(w => w.id as string);

      if (worklogIds.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }

      // 해당 업무일지들의 첨부파일 조회
      const attachments = await query<Record<string, unknown>>(SHEET_NAMES.ATTACHMENTS, {
        filters: [
          { column: 'entityType', op: 'eq', value: 'worklog' },
          { column: 'entityId', op: 'in', value: worklogIds },
        ],
        orderBy: { column: 'createdAt', ascending: false },
      });

      // 사용자 이름 매핑
      const users = await getAllAsObjects<Record<string, unknown>>(SHEET_NAMES.USERS);
      const userMap = new Map(users.map(u => [u.id as string, u.name as string]));

      // 업무일지 정보 매핑
      const worklogMap = new Map(worklogs.map(w => [w.id as string, w]));

      const enriched = attachments.map(att => {
        const wl = worklogMap.get(att.entityId as string);
        return {
          ...att,
          worklogDate: wl?.date || '',
          worklogStage: wl?.stage || '',
          uploaderName: userMap.get(att.uploadedById as string) || att.uploadedById,
        };
      });

      return NextResponse.json({ success: true, data: enriched });
    }

    return NextResponse.json(
      { success: false, error: 'entityType+entityId 또는 projectId가 필요합니다.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('첨부파일 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/attachments
 * PDF 파일 업로드
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const userRole = session.user.role;
    if (!['engineer', 'admin'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: '파일 업로드 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string;
    const entityId = formData.get('entityId') as string;

    if (!file || !entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: 'file, entityType, entityId가 필요합니다.' },
        { status: 400 }
      );
    }

    // PDF만 허용
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'PDF 파일만 업로드할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 10MB 제한
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 10MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const attachmentId = await generateAttachmentId();
    const storagePath = `${entityType}/${entityId}/${file.name}`;

    // Storage 업로드
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`파일 업로드 실패: ${uploadError.message}`);
    }

    // 공개 URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    // DB에 메타데이터 저장
    const now = new Date().toISOString();
    const attachmentData: Record<string, unknown> = {
      id: attachmentId,
      entityType,
      entityId,
      fileName: file.name,
      fileUrl: urlData.publicUrl,
      fileSize: file.size,
      uploadedById: session.user.id,
      createdAt: now,
    };

    await insertRow(SHEET_NAMES.ATTACHMENTS, attachmentData);

    return NextResponse.json({
      success: true,
      data: attachmentData,
      message: '파일이 업로드되었습니다.',
    });
  } catch (error) {
    console.error('첨부파일 업로드 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
