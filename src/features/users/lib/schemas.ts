import { z } from 'zod';
import type { UserRole, UserStatus } from '@/features/users/lib/types';

const roleKeySchema = z.enum(['owner', 'admin', 'member', 'viewer']);
const statusKeySchema = z.enum(['active', 'invited', 'suspended']);
const sortKeySchema = z.enum(['name', 'role', 'status', 'lastActiveAt', 'joinedAt']);
const sortDirSchema = z.enum(['asc', 'desc']);
const pageSizeSchema = z.union([z.literal(10), z.literal(25), z.literal(50)]);

export type RoleKey = z.infer<typeof roleKeySchema>;
export type StatusKey = z.infer<typeof statusKeySchema>;
export type SortKey = z.infer<typeof sortKeySchema>;
export type SortDir = z.infer<typeof sortDirSchema>;
export type PageSize = z.infer<typeof pageSizeSchema>;

export const usersSearchSchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  role: roleKeySchema.optional().catch(undefined),
  status: statusKeySchema.optional().catch(undefined),
  sort: sortKeySchema.optional().catch(undefined),
  dir: sortDirSchema.optional().catch(undefined),
  size: z.coerce.number().pipe(pageSizeSchema).optional().catch(undefined),
  page: z.coerce.number().int().min(0).optional().catch(undefined),
});

export type UsersSearch = z.infer<typeof usersSearchSchema>;

export const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
} as const satisfies Record<RoleKey, UserRole>;

export const STATUS_LABELS = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
} as const satisfies Record<StatusKey, UserStatus>;

export const ROLE_KEYS = Object.keys(ROLE_LABELS) as RoleKey[];
export const STATUS_KEYS = Object.keys(STATUS_LABELS) as StatusKey[];

export const PAGE_SIZES: readonly PageSize[] = [10, 25, 50];
export const DEFAULT_SORT: SortKey = 'lastActiveAt';
export const DEFAULT_DIR: SortDir = 'desc';
export const DEFAULT_PAGE_SIZE: PageSize = 10;
