import * as z from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  acceptTerms: z
    .boolean()
    .refine((v) => v, 'You must accept the Privacy Policy and Terms of Service to continue.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
};
