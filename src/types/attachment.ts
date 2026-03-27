/**
 * 첨부파일 타입 정의
 */

import type { ProjectStage } from './project';

/** 첨부파일 엔티티 타입 */
export type AttachmentEntityType = 'project' | 'worklog' | 'meeting';

/** 첨부파일 */
export interface Attachment {
  id: string;
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedById: string;
  createdAt: string;
}

/** 첨부파일 + 업무일지 정보 (프로젝트 상세 탭용) */
export interface AttachmentWithWorklog extends Attachment {
  worklogDate?: string;
  worklogStage?: ProjectStage;
  uploaderName?: string;
}
