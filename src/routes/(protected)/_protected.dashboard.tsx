/* DEMO ONLY - this dashboard is a showcase composed of mocked widgets from `./-dashboard/`. To remove the demo, delete the `-dashboard/` folder and replace the body of `DashboardPage` with the real implementation. */
import { createFileRoute } from '@tanstack/react-router';
import { KpiCards } from '@/routes/(protected)/-dashboard/kpi-cards';
import { ProjectsTable } from '@/routes/(protected)/-dashboard/projects-table';
import { SignupsChart } from '@/routes/(protected)/-dashboard/signups-chart';
import { VisitorsChart } from '@/routes/(protected)/-dashboard/visitors-chart';

export const Route = createFileRoute('/(protected)/_protected/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="@container/main mx-auto flex w-full flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <KpiCards />
      <div className="grid grid-cols-1 gap-4 lg:gap-6 @5xl/main:grid-cols-3">
        <VisitorsChart className="@5xl/main:col-span-2" />
        <SignupsChart />
      </div>
      <ProjectsTable />
    </div>
  );
}
