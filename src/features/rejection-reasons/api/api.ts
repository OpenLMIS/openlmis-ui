import {
  normalizeRejectionReason,
  normalizeRejectionReasonCategory,
  type RejectionReasonCategoryResponse,
  type RejectionReasonResponse,
} from '@/features/reference-data/lib/rejection-reasons';
import type {
  RejectionReasonBody,
  RejectionReasonCategoryBody,
} from '@/features/rejection-reasons/lib/types';
import { client } from '@/integrations/axios';

export async function fetchRejectionReasonCategory(id: string) {
  const { data } = await client.get<RejectionReasonCategoryResponse>(
    `/rejectionReasonCategories/${id}`,
  );
  return normalizeRejectionReasonCategory(data);
}

export async function saveRejectionReasonCategory(body: RejectionReasonCategoryBody) {
  const { data } = await client.post<RejectionReasonCategoryResponse>(
    '/rejectionReasonCategories',
    body,
  );
  return normalizeRejectionReasonCategory(data);
}

export async function fetchRejectionReason(id: string) {
  const { data } = await client.get<RejectionReasonResponse>(`/rejectionReasons/${id}`);
  return normalizeRejectionReason(data);
}

export async function saveRejectionReason(body: RejectionReasonBody) {
  const { data } = await client.post<RejectionReasonResponse>('/rejectionReasons', body);
  return normalizeRejectionReason(data);
}
