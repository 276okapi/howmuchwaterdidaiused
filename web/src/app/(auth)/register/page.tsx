import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { socialProviderStatus } from "@/lib/auth-options.mjs";
import AuthForm from "../AuthForm";
import AuthShell from "../AuthShell";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSession()) redirect("/pulpit");
  return (
    <AuthShell>
      <Suspense>
        <AuthForm mode="register" providers={socialProviderStatus()} />
      </Suspense>
    </AuthShell>
  );
}
