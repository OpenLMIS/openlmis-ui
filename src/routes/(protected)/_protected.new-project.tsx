/* DEMO ONLY - this new-project page is a showcase of shadcn field primitives composed through TanStack Form + Zod. To remove the demo, delete the `-new-project/` folder, this route file, the `src/features/new-project/` folder, and the `new-project.title` nav entry in `src/lib/config.ts`. */
import { createFileRoute } from '@tanstack/react-router';
import { NewProjectForm } from '@/routes/(protected)/-new-project/new-project-form';

export const Route = createFileRoute('/(protected)/_protected/new-project')({
  component: NewProjectPage,
});

function NewProjectPage() {
  return (
    <div className="@container/main mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <NewProjectForm />
    </div>
  );
}
