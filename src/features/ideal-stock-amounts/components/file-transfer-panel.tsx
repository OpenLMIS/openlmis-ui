import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';

export function FileTransferPanel({ children }: { children: ReactNode }) {
  return <Card>{children}</Card>;
}

export function FileTransferExport({ children }: { children: ReactNode }) {
  return (
    <CardContent>
      <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
    </CardContent>
  );
}

export function FileTransferUpload({ children }: { children: ReactNode }) {
  return (
    <CardContent>
      <FieldGroup>{children}</FieldGroup>
    </CardContent>
  );
}
