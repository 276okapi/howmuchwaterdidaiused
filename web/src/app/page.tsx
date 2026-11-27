import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// For now the home page just routes: signed in -> report, otherwise -> sign in.
// (A public landing page and rankings come later.)
export default async function Home() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
