import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';

export function FileTransferPanel({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <FieldGroup>{children}</FieldGroup>
      </CardContent>
    </Card>
  );
}

export function FileTransferExport({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>;
}

export function FileTransferInstructions({ children }: { children: ReactNode }) {
  return (
    <>
      <Separator />
      <p className="whitespace-pre-line wrap-break-word text-muted-foreground text-sm leading-relaxed">
        {children}
      </p>
    </>
  );
}

export function FileTransferUpload({ children }: { children: ReactNode }) {
  return <FieldGroup>{children}</FieldGroup>;
}
