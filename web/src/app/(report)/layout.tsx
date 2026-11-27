// /dashboard, /days and /prompts share this layout, so the report frame stays loaded
// while the menu switches between its views.
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getTurns } from "@/lib/turns";
import AppShell from "@/components/AppShell";
import ReportFrame from "./ReportFrame";
import { getL } from "@/lib/lang";

export const dynamic = "force-dynamic";

export default async function ReportLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const hasData = session ? (await getTurns(session.user.id)).length > 0 : false;
  const { L } = await getL();

  return (
    <AppShell path="/dashboard" full={hasData}>
      {hasData ? (
        <ReportFrame title={L("Raport", "Report")} />
      ) : (
        <div className="empty-state">
          <h1>{L("Nie ma jeszcze danych", "No data yet")}</h1>
          <p>
            {L(
              "Raport pojawi się, gdy agent wyśle statystyki z komputera, na którym pracujesz z asystentem AI.",
              "The report appears once the agent sends stats from the computer where you work with your AI assistant.",
            )}
          </p>
          <p><Link className="btn btn-primary" href="/agent">{L("Zainstaluj agenta", "Install the agent")}</Link></p>
        </div>
      )}
      {children}
    </AppShell>
  );
}
