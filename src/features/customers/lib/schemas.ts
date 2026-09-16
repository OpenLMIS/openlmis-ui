import { z } from 'zod';
import type { CustomerPlan, CustomerStatus } from '@/features/customers/lib/types';

const planKeySchema = z.enum(['free', 'starter', 'pro', 'enterprise']);
const statusKeySchema = z.enum(['active', 'trial', 'past_due', 'canceled']);
const sortKeySchema = z.enum(['name', 'company', 'plan', 'status', 'mrr', 'joinedAt']);
const sortDirSchema = z.enum(['asc', 'desc']);
const pageSizeSchema = z.union([z.literal(10), z.literal(25), z.literal(50)]);

export type PlanKey = z.infer<typeof planKeySchema>;
export type StatusKey = z.infer<typeof statusKeySchema>;
export type SortKey = z.infer<typeof sortKeySchema>;
export type SortDir = z.infer<typeof sortDirSchema>;
export type PageSize = z.infer<typeof pageSizeSchema>;

export const customersSearchSchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  plan: planKeySchema.optional().catch(undefined),
  status: statusKeySchema.optional().catch(undefined),
  sort: sortKeySchema.optional().catch(undefined),
  dir: sortDirSchema.optional().catch(undefined),
  size: z.coerce.number().pipe(pageSizeSchema).optional().catch(undefined),
  page: z.coerce.number().int().min(0).optional().catch(undefined),
});

export type CustomersSearch = z.infer<typeof customersSearchSchema>;

export const PLAN_LABELS = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
} as const satisfies Record<PlanKey, CustomerPlan>;

export const STATUS_LABELS = {
  active: 'Active',
  trial: 'Trial',
  past_due: 'Past Due',
  canceled: 'Canceled',
} as const satisfies Record<StatusKey, CustomerStatus>;

export const PLAN_KEYS = Object.keys(PLAN_LABELS) as PlanKey[];
export const STATUS_KEYS = Object.keys(STATUS_LABELS) as StatusKey[];

export const PAGE_SIZES: readonly PageSize[] = [10, 25, 50];
export const DEFAULT_SORT: SortKey = 'joinedAt';
export const DEFAULT_DIR: SortDir = 'desc';
export const DEFAULT_PAGE_SIZE: PageSize = 10;
