import { z } from 'zod';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';

const uploadResultSchema = z.object({
  amount: z.number().int().nonnegative(),
});

export type UploadResult = z.infer<typeof uploadResultSchema>;

export const csvFileSchema = z.object({
  file: z
    .custom<File | undefined>()
    .refine((file) => file instanceof File, 'file-transfer.file-required')
    .refine((file) => !file || /\.csv$/i.test(file.name), 'file-transfer.file-csv')
    .refine((file) => !file || file.size > 0, 'file-transfer.file-empty'),
});

export function exportCsv(path: string): Promise<Blob> {
  return fetchReport(path, { format: 'csv' });
}

/** Uploads a CSV file unchanged and returns how many records the server processed. */
export async function uploadCsv(path: string, file: File): Promise<UploadResult> {
  const body = new FormData();
  // The server's extension check is case-sensitive.
  body.append('file', file, file.name.replace(/\.csv$/i, '.csv'));
  const { data } = await client.post<unknown>(path, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { format: 'csv' },
    timeout: 300_000,
  });
  return uploadResultSchema.parse(data);
}
