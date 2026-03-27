/**
 * Supabase 데이터베이스 모듈
 *
 * 기존 '@/lib/google'를 대체합니다.
 * Google Drive 관련 기능은 '@/lib/google/drive'에서 직접 import하세요.
 */

export * from './db';
export { getSupabase } from './client';
