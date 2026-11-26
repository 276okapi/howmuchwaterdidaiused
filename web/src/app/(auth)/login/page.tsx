import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { enabledSocialProviders } from "@/lib/auth-options.mjs";
import AuthForm from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/raport");
  return (
    <Suspense>
      <AuthForm mode="login" providers={enabledSocialProviders()} />
    </Suspense>
  );
}
