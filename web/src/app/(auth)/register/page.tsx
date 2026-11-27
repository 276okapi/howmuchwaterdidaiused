import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { socialProviderStatus } from "@/lib/auth-options.mjs";
import AuthForm from "../AuthForm";
import AuthShell from "../AuthShell";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <AuthShell>
      <Suspense>
        <AuthForm mode="register" providers={socialProviderStatus()} lang={await getLang()} />
      </Suspense>
    </AuthShell>
  );
}
