import { FolderIcon } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PROJECTS } from '@/routes/(protected)/-dashboard/mock-data';

export function ProjectsTable() {
  return (
    <Card surface="background">
      <CardHeader>
        <CardTitle>Active Projects</CardTitle>
        <CardDescription>Status and ownership across in-flight initiatives</CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead gutter="start">Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Team</TableHead>
            <TableHead gutter="end" className="text-right">
              Due
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PROJECTS.map((project) => (
            <TableRow key={project.name}>
              <TableCell gutter="start">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center bg-muted">
                    <FolderIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{project.name}</span>
                    <span className="text-xs text-muted-foreground">{project.description}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge>{project.status}</Badge>
              </TableCell>
              <TableCell>
                <AvatarGroup>
                  {project.team.map((member) => (
                    <Avatar key={member.fallback} size="sm">
                      <AvatarImage src={member.src} alt={member.fallback} />
                      <AvatarFallback>{member.fallback}</AvatarFallback>
                    </Avatar>
                  ))}
                  {project.extra > 0 && (
                    <AvatarGroupCount>
                      <span className="text-2xs text-muted-foreground">+{project.extra}</span>
                    </AvatarGroupCount>
                  )}
                </AvatarGroup>
              </TableCell>
              <TableCell size="sm" tone="muted" gutter="end" className="text-right">
                {project.dueDate}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
