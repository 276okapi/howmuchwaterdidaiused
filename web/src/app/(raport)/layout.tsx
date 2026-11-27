// /pulpit, /dni and /prompty share this layout, so the report frame stays loaded
// while the menu switches between its views.
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getTurns } from "@/lib/turns";
import AppShell from "@/components/AppShell";
import ReportFrame from "./ReportFrame";

export const dynamic = "force-dynamic";

export default async function ReportLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const hasData = session ? (await getTurns(session.user.id)).length > 0 : false;

  return (
    <AppShell path="/pulpit" full={hasData}>
      {hasData ? (
        <ReportFrame />
      ) : (
        <div className="empty-state">
          <h1>Nie ma jeszcze danych</h1>
          <p>
            Raport pojawi się, gdy agent wyśle statystyki z komputera, na którym pracujesz z asystentem AI.
          </p>
          <p><Link className="btn btn-primary" href="/agent">Zainstaluj agenta</Link></p>
        </div>
      )}
      {children}
    </AppShell>
  );
}
