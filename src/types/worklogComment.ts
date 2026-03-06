/**
 * 업무일지 댓글 타입 정의
 * Google Sheets: WorklogComments 시트
 */

/** 업무일지 댓글 */
export interface WorklogComment {
  id: string;              // WLC-00001 형식
  worklogId: string;       // FK → WorkLogs
  authorId: string;        // FK → Users
  authorName: string;      // 비정규화 (작성자명)
  parentId?: string;       // FK → self (답글용)
  content: string;
  createdAt: string;       // ISO 8601 타임스탬프
}

/** 댓글 생성 입력 */
export interface CreateWorklogCommentInput {
  content: string;
  parentId?: string;       // 답글 시 부모 댓글 ID
}

/** 댓글 스레드 (부모 + 답글) */
export interface WorklogCommentThread {
  comment: WorklogComment;
  replies: WorklogComment[];
}
