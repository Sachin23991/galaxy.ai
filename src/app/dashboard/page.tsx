import { DashboardClient } from "./_components/DashboardClient";

// No blocking DB query here — the shell renders instantly.
// DashboardClient fetches its own data via /api/workflows on mount.
export default function DashboardPage() {
  return <DashboardClient initialWorkflows={[]} />;
}
