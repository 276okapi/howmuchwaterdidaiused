// Frame for every page after sign-in: top bar with the menu button, slide-out menu, content.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SideMenu from "./SideMenu";
import "./app.css";

export default async function AppShell({
  children,
  path,
  full = false,
  wide = false,
}: {
  children: React.ReactNode;
  /** current path, used to come back here after signing in */
  path: string;
  /** content fills the whole area (the report frame) instead of a centered column */
  full?: boolean;
  /** a wider centered column (pages laid out in columns) */
  wide?: boolean;
}) {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(path)}`);
  return (
    <div className="app">
      <SideMenu name={session.user.name || session.user.email} email={session.user.email} />
      <main className={full ? "app-main full" : wide ? "app-main wide" : "app-main"}>{children}</main>
    </div>
  );
}
