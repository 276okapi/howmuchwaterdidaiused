"use client";
// The report (report-template.html) keeps its own styles and scripts, so it runs in a frame.
// The address of the page and the view inside the frame follow each other:
//   /pulpit <-> #pulpit, /dni <-> #dzien[/YYYY-MM-DD], /prompty <-> #prompty
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const HASH: Record<string, string> = { "/pulpit": "#pulpit", "/dni": "#dzien", "/prompty": "#prompty" };
const viewOfHash = (h: string) => (/^#dzien/.test(h) ? "/dni" : h === "#prompty" ? "/prompty" : "/pulpit");

export default function ReportFrame() {
  const pathname = usePathname();
  const ref = useRef<HTMLIFrameElement>(null);
  // first address only; later changes go through the hash, without reloading the frame
  const src = useRef(`/raport/widok${HASH[pathname] ?? "#pulpit"}`);

  // menu click -> show that view in the frame (keep the chosen day when already on /dni)
  useEffect(() => {
    const win = ref.current?.contentWindow;
    if (!win) return;
    try {
      if (viewOfHash(win.location.hash) !== pathname) win.location.hash = HASH[pathname] ?? "#pulpit";
    } catch {
      /* frame not loaded yet: it starts from src */
    }
  }, [pathname]);

  // view changed inside the report (e.g. a day picked on the calendar) -> update address and menu
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || typeof e.data?.cwHash !== "string") return;
      const path = viewOfHash(e.data.cwHash);
      if (path !== window.location.pathname) window.history.replaceState(null, "", path);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return <iframe ref={ref} className="app-frame" src={src.current} title="Raport" />;
}
