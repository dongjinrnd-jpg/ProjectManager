/**
 * 마스터 데이터 타입 정의
 *
 * 고객사, 모델 등 프로젝트 생성 시 선택 가능한 마스터 데이터
 */

/**
 * 고객사 마스터
 */
export interface Customer {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 모델 마스터
 */
export interface Model {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 고객사 목록 응답
 */
export interface CustomersResponse {
  customers: Customer[];
  total: number;
}

/**
 * 모델 목록 응답
 */
export interface ModelsResponse {
  models: Model[];
  total: number;
}
