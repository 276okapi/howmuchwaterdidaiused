import { getSession } from "@/lib/auth";
import { getLastIngest } from "@/lib/turns";
import AppShell from "@/components/AppShell";
import AgentSetup from "./AgentSetup";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const session = await getSession();
  const last = session ? await getLastIngest(session.user.id) : null;

  return (
    <AppShell path="/agent">
      <h1>Agent</h1>
      <p className="sub">
        Mały program na Twoim komputerze. Co jakiś czas liczy statystyki pracy z asystentem AI
        i wysyła je na to konto. Działa w tle, bez uprawnień administratora.
      </p>

      <div className={last ? "agent-status ok" : "agent-status"}>
        <span className="dot" aria-hidden />
        {last ? (
          <>Ostatnie dane dotarły {new Date(last).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" })}.</>
        ) : (
          <>Na to konto nie dotarły jeszcze żadne dane. Zainstaluj agenta poniżej.</>
        )}
      </div>

      <AgentSetup />
    </AppShell>
  );
}
