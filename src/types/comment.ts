/**
 * 경영진 코멘트 관련 타입 정의
 * Google Sheets: Comments 시트
 */

/**
 * 경영진 코멘트
 * - parentId가 없으면 최초 코멘트 (경영진)
 * - parentId가 있으면 답변 (팀장)
 */
export interface Comment {
  /** 코멘트 ID (PK) - 예: CMT-001 */
  id: string;
  /** 프로젝트 ID (FK → Projects) */
  projectId: string;
  /** 작성자 ID (FK → Users) */
  authorId: string;
  /** 부모 코멘트 ID (답변용) */
  parentId?: string;
  /** 코멘트 내용 */
  content: string;
  /** 작성일시 */
  createdAt: string;
}

/**
 * 코멘트 생성 입력 타입
 */
export interface CreateCommentInput {
  projectId: string;
  content: string;
  /** 답변인 경우 부모 코멘트 ID */
  parentId?: string;
}

/**
 * 코멘트 스레드 (코멘트 + 답변들)
 */
export interface CommentThread {
  /** 원본 코멘트 */
  comment: Comment;
  /** 답변 목록 */
  replies: Comment[];
  /** 작성자 이름 (조인) */
  authorName: string;
}
