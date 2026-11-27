import { getSession } from "@/lib/auth";
import { getLastIngest } from "@/lib/turns";
import AppShell from "@/components/AppShell";
import AgentSetup from "./AgentSetup";
import { getL } from "@/lib/lang";
import { localeOf } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const session = await getSession();
  const last = session ? await getLastIngest(session.user.id) : null;
  const { lang, L } = await getL();

  return (
    <AppShell path="/agent" wide>
      <div className="agent-page">
        <header className="page-head">
          <div>
            <h1>Agent</h1>
            <p className="sub">
              {L(
                "Mały program na Twoim komputerze: co jakiś czas liczy statystyki pracy z asystentem AI i wysyła je na to konto.",
                "A small program on your computer: every so often it counts the stats of your work with an AI assistant and sends them to this account.",
              )}
            </p>
          </div>
          <div className={last ? "agent-status ok" : "agent-status"}>
            <span className="dot" aria-hidden />
            {last ? (
              <>{L("Ostatnie dane", "Last data")}: {new Date(last).toLocaleString(localeOf(lang), { dateStyle: "medium", timeStyle: "short" })}</>
            ) : (
              <>{L("Nie dotarły jeszcze żadne dane", "No data has arrived yet")}</>
            )}
          </div>
        </header>
        <AgentSetup lang={lang} />
      </div>
    </AppShell>
  );
}
