// import { client } from '@/integrations/axios';
import type { NewProjectInput } from '@/features/new-project/lib/types';

/*
  TODO: Replace the mock with a real POST /projects call. Throw
  `CreateProjectError` for 4xx domain failures (duplicate slug, quota
  exceeded, etc.) so the form can surface the message via toast without
  special-casing each status code.
*/
export class CreateProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreateProjectError';
  }
}

export type CreatedProject = { id: string };

export async function createProject(input: NewProjectInput): Promise<CreatedProject> {
  // Real implementation:
  //   const res = await client.post<CreatedProject>('/projects', input);
  //   return res.data;

  // Mock latency so the loading state is visible during the demo.
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Demo failure gate: the literal name "fail" trips the error path so
  // reviewers can see the toast + error handling end-to-end.
  if (input.name.trim().toLowerCase() === 'fail') {
    throw new CreateProjectError('A project with that name already exists.');
  }

  return { id: `prj_${Date.now().toString(36)}` };
}
