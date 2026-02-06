/**
 * 첨부파일 관련 타입 정의
 * Google Sheets: Attachments 시트
 */

/**
 * 첨부파일 대상 유형
 */
export type AttachmentTargetType = 'project' | 'worklog';

/**
 * 첨부파일
 */
export interface Attachment {
  /** 첨부파일 ID (PK) - 예: ATT-001 */
  id: string;
  /** 대상 유형 (project | worklog) */
  targetType: AttachmentTargetType;
  /** 대상 ID */
  targetId: string;
  /** 파일명 */
  fileName: string;
  /** MIME 타입 */
  fileType: string;
  /** 파일 크기 (bytes) */
  fileSize: number;
  /** Google Drive URL */
  fileUrl: string;
  /** 업로더 ID (FK → Users) */
  uploadedById: string;
  /** 업로드일시 */
  uploadedAt: string;
}

/**
 * 첨부파일 업로드 입력 타입
 */
export interface UploadAttachmentInput {
  targetType: AttachmentTargetType;
  targetId: string;
  file: File;
}

/**
 * 첨부파일 메타데이터 (업로드 후)
 */
export interface AttachmentMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
}
