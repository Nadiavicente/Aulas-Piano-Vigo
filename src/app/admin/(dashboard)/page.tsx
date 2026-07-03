import { getAllRounds } from "@/lib/booking";
import { OccupancyDashboard } from "./OccupancyDashboard";

export default async function AdminDashboardPage() {
  const rounds = await getAllRounds();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl font-semibold text-ink">Resumen de ocupación</h1>
      <OccupancyDashboard rounds={rounds} />
    </div>
  );
}
