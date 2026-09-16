import * as z from 'zod';

/*
  Shared ISO YYYY-MM-DD validator. Re-used by the stock-movement wizard
  schema - keep it here so any future form that stores dates as strings
  imports it from a single place. The regex catches format drift; the
  Date.parse refine rejects invalid calendar dates (e.g. 2026-02-31)
  that the regex alone would accept.
*/
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Pick a valid date.');

export const PROJECT_STATUSES = ['Draft', 'Active', 'On Hold'] as const;
export const PROJECT_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const PROJECT_VISIBILITIES = ['Private', 'Team', 'Public'] as const;
export const PROJECT_NOTIFY_EVENTS = ['created', 'updates', 'milestones', 'completed'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];
export type ProjectVisibility = (typeof PROJECT_VISIBILITIES)[number];
export type ProjectNotifyEvent = (typeof PROJECT_NOTIFY_EVENTS)[number];

/*
  Slug validator - lowercase letters/digits/hyphens, 3–40 chars, must
  start and end with an alphanumeric so we don't accept empty segments
  when the slug is used as a URL path.
*/
const slugSchema = z
  .string()
  .trim()
  .min(3, 'At least 3 characters.')
  .max(40, 'At most 40 characters.')
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Lowercase letters, digits, and hyphens.');

const newProjectShape = {
  name: z.string().trim().min(3, 'At least 3 characters.').max(80, 'At most 80 characters.'),
  slug: slugSchema,
  description: z.string().max(500, 'At most 500 characters.'),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(PROJECT_PRIORITIES),
  ownerId: z.string().min(1, 'Pick an owner.'),
  startDate: isoDate,
  dueDate: isoDate,
  budget: z.number().nonnegative('Budget must be ≥ 0.'),
  visibility: z.enum(PROJECT_VISIBILITIES),
  notifyOn: z.array(z.enum(PROJECT_NOTIFY_EVENTS)).min(1, 'Pick at least one event.'),
  sendInvites: z.boolean(),
  acceptTerms: z.boolean().refine((v) => v, 'Accept the terms to continue.'),
};

/*
  The cross-field rule lives on the combined schema so it survives
  through submit. The disabled-date function on the `dueDate` field
  provides live pre-submit feedback by reading `startDate` via
  useStore(form.store, ...) - see `src/components/date-field.tsx` and
  the `new-project-form.tsx` dueDate wiring.
*/
export const newProjectSchema = z.object(newProjectShape).superRefine((v, ctx) => {
  if (v.startDate && v.dueDate && v.dueDate < v.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dueDate'],
      message: 'Due date must be on or after the start date.',
    });
  }
});

export type NewProjectInput = z.infer<typeof newProjectSchema>;

export const DEFAULT_NEW_PROJECT: NewProjectInput = {
  name: '',
  slug: '',
  description: '',
  status: 'Draft',
  priority: 'Medium',
  ownerId: '',
  startDate: '',
  dueDate: '',
  budget: 0,
  visibility: 'Team',
  notifyOn: ['created', 'updates'],
  sendInvites: false,
  acceptTerms: false,
};

/*
  Helper: derive a URL-safe slug from a free-text name. Used to
  auto-populate the slug field while the user types, so the common
  case doesn't require a second manual entry.
*/
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export type ProjectOwner = {
  id: string;
  name: string;
  email: string;
  avatarFallback: string;
  avatarUrl: string;
};

const avatar = (email: string) => `https://i.pravatar.cc/128?u=${encodeURIComponent(email)}`;

export const MOCK_OWNERS: ProjectOwner[] = [
  {
    id: 'ada',
    name: 'Ada Lovelace',
    email: 'ada@soldevelo.com',
    avatarFallback: 'AL',
    avatarUrl: avatar('ada@soldevelo.com'),
  },
  {
    id: 'grace',
    name: 'Grace Hopper',
    email: 'grace@soldevelo.com',
    avatarFallback: 'GH',
    avatarUrl: avatar('grace@soldevelo.com'),
  },
  {
    id: 'alan',
    name: 'Alan Turing',
    email: 'alan@soldevelo.com',
    avatarFallback: 'AT',
    avatarUrl: avatar('alan@soldevelo.com'),
  },
  {
    id: 'kat',
    name: 'Katherine Johnson',
    email: 'kat@soldevelo.com',
    avatarFallback: 'KJ',
    avatarUrl: avatar('kat@soldevelo.com'),
  },
  {
    id: 'hedy',
    name: 'Hedy Lamarr',
    email: 'hedy@soldevelo.com',
    avatarFallback: 'HL',
    avatarUrl: avatar('hedy@soldevelo.com'),
  },
  {
    id: 'margaret',
    name: 'Margaret Hamilton',
    email: 'margaret@soldevelo.com',
    avatarFallback: 'MH',
    avatarUrl: avatar('margaret@soldevelo.com'),
  },
  {
    id: 'barbara',
    name: 'Barbara Liskov',
    email: 'barbara@soldevelo.com',
    avatarFallback: 'BL',
    avatarUrl: avatar('barbara@soldevelo.com'),
  },
  {
    id: 'radia',
    name: 'Radia Perlman',
    email: 'radia@soldevelo.com',
    avatarFallback: 'RP',
    avatarUrl: avatar('radia@soldevelo.com'),
  },
];
