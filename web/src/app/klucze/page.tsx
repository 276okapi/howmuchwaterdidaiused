import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import ApiKeys from "./ApiKeys";

export const dynamic = "force-dynamic";

async function listKeys() {
  try {
    const { apiKeys } = await auth.api.listApiKeys({ headers: await headers() });
    return apiKeys.map(k => ({
      id: k.id,
      name: k.name ?? "",
      start: k.start ?? "",
      createdAt: new Date(k.createdAt).toISOString(),
      lastRequest: k.lastRequest ? new Date(k.lastRequest).toISOString() : null,
    }));
  } catch {
    return []; // not signed in: AppShell redirects
  }
}

export default async function KeysPage() {
  const keys = await listKeys();
  return (
    <AppShell path="/klucze">
      <h1>Klucze API</h1>
      <p className="sub">
        Klucz łączy dane wysyłane z Twojego komputera z tym kontem. Serwer przechowuje tylko jego skrót,
        więc pełny klucz zobaczysz jeden raz, zaraz po utworzeniu. Każdy komputer może mieć osobny klucz.
      </p>
      <section className="card">
        <ApiKeys keys={keys} />
      </section>
    </AppShell>
  );
}
