import { getSession } from "@/lib/auth";
import { getLastIngest } from "@/lib/turns";
import AppShell from "@/components/AppShell";
import AgentSetup from "./AgentSetup";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const session = await getSession();
  const last = session ? await getLastIngest(session.user.id) : null;

  return (
    <AppShell path="/agent" wide>
      <div className="agent-page">
        <header className="page-head">
          <div>
            <h1>Agent</h1>
            <p className="sub">
              Mały program na Twoim komputerze: co jakiś czas liczy statystyki pracy z asystentem AI i wysyła je na to konto.
            </p>
          </div>
          <div className={last ? "agent-status ok" : "agent-status"}>
            <span className="dot" aria-hidden />
            {last ? (
              <>Ostatnie dane: {new Date(last).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" })}</>
            ) : (
              <>Nie dotarły jeszcze żadne dane</>
            )}
          </div>
        </header>
        <AgentSetup />
      </div>
    </AppShell>
  );
}
