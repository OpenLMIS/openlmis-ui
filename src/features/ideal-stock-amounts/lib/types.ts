import { z } from 'zod';

export const idealStockAmountsUploadResultSchema = z.object({
  amount: z.number().int().nonnegative(),
});

export type IdealStockAmountsUploadResult = z.infer<typeof idealStockAmountsUploadResultSchema>;

export const idealStockAmountsUploadSchema = z.object({
  file: z
    .custom<File | undefined>()
    .refine((file) => file instanceof File, 'ideal-stock-amounts.file-required')
    .refine((file) => !file || /\.csv$/i.test(file.name), 'ideal-stock-amounts.file-csv')
    .refine((file) => !file || file.size > 0, 'ideal-stock-amounts.file-empty'),
});
