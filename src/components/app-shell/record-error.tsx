import type { ErrorComponentProps } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ChevronLeftIcon, SearchXIcon } from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Workspace, WorkspaceContent } from '@/components/workspace/workspace';
import { isNotFound } from '@/lib/http';

export function RecordError({
  backLink,
  labels,
  width,
  ...props
}: ErrorComponentProps & {
  backLink: ReactElement;
  labels: {
    back: string;
    title: string;
    description: string;
    notFoundTitle: string;
    notFoundDescription: string;
  };
  width?: ComponentProps<typeof Workspace>['width'];
}) {
  const notFound =
    isNotFound(props.error) || (isAxiosError(props.error) && props.error.response?.status === 400);
  const back = (
    <Button
      nativeButton={false}
      render={backLink}
      size={notFound ? 'sm' : 'lg'}
      variant={notFound ? 'outline' : 'default'}
    >
      <ChevronLeftIcon className="rtl:rotate-180" data-icon="inline-start" />
      {labels.back}
    </Button>
  );
  if (!notFound) {
    return (
      <ErrorFallback {...props} back={back} description={labels.description} title={labels.title} />
    );
  }
  return (
    <Workspace width={width}>
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>
              <h1>{labels.notFoundTitle}</h1>
            </EmptyTitle>
            <EmptyDescription>{labels.notFoundDescription}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{back}</EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
