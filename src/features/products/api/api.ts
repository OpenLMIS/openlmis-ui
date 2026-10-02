import type {
  Approval,
  CreateProductBody,
  NewApproval,
  Product,
  ProductDetail,
  ProductsQuery,
} from '@/features/products/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchProducts(query: ProductsQuery) {
  const { data } = await client.get<Page<Product>>('/orderables', { params: query });
  return data;
}

export async function createProduct(body: CreateProductBody) {
  const { data } = await client.put<Product>('/orderables', body);
  return data;
}

export async function fetchProduct(id: string) {
  const { data } = await client.get<ProductDetail>(`/orderables/${id}`);
  return data;
}

export async function updateProduct(id: string, body: ProductDetail) {
  const { data } = await client.put<ProductDetail>(`/orderables/${id}`, body);
  return data;
}

const APPROVALS = '/facilityTypeApprovedProducts';

export async function fetchApprovals(orderableId: string) {
  const { data } = await client.get<Page<Approval>>(APPROVALS, { params: { orderableId } });
  return data.content;
}

export async function fetchApproval(id: string) {
  const { data } = await client.get<Approval>(`${APPROVALS}/${id}`);
  return data;
}

export async function updateApproval(approval: Approval) {
  const { data } = await client.put<Approval>(`${APPROVALS}/${approval.id}`, approval);
  return data;
}

export async function addApproval({ orderableId, facilityType, program, stock }: NewApproval) {
  const { data: removed } = await client.get<Page<Approval>>(APPROVALS, {
    params: { orderableId, facilityType: facilityType.code, program: program.code, active: false },
  });
  const previous = removed.content[0];
  if (previous) return updateApproval({ ...previous, ...stock, active: true });
  const { data } = await client.post<Approval>(APPROVALS, {
    orderable: { id: orderableId },
    facilityType: { id: facilityType.id },
    program: { id: program.id },
    ...stock,
    active: true,
  });
  return data;
}

export async function removeApproval(id: string) {
  const latest = await fetchApproval(id);
  return updateApproval({ ...latest, active: false });
}

export async function fetchProductsByIds(ids: readonly string[]) {
  if (ids.length === 0) return [];
  const { data } = await client.get<Page<Product>>('/orderables', {
    params: { id: ids },
    paramsSerializer: { indexes: null },
  });
  return data.content;
}

export async function saveProductChange(
  id: string,
  change: (latest: ProductDetail) => ProductDetail,
) {
  return updateProduct(id, change(await fetchProduct(id)));
}
