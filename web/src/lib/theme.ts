// Theme: "auto" (follows the system), "light" or "dark", remembered in this browser.
// The key is shared with the report (report-template.html), which runs on the same site.
export type ThemePref = "auto" | "light" | "dark";
export const THEME_KEY = "promptStatsTheme";

/** Runs in <head> before the page paints, so there is no flash of the wrong theme. */
export const THEME_BOOT = `(function(){try{
var k=${JSON.stringify(THEME_KEY)},m=matchMedia("(prefers-color-scheme: dark)");
function a(){var t=localStorage.getItem(k)||"auto";document.documentElement.dataset.theme=t==="auto"?(m.matches?"dark":"light"):t;}
a();m.addEventListener("change",a);addEventListener("storage",function(e){if(e.key===k)a();});
}catch(e){document.documentElement.dataset.theme="light";}})();`;

export function getThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "auto";
  } catch {
    return "auto";
  }
}

export function setThemePref(t: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* storage blocked: applies to this page only */
  }
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  // the report frame understands "light" / "dark", and no attribute for auto
  document.querySelectorAll("iframe").forEach(f => {
    try {
      const root = f.contentDocument?.documentElement;
      if (!root) return;
      if (t === "auto") delete root.dataset.theme;
      else root.dataset.theme = t;
    } catch {
      /* frame from another origin */
    }
  });
}
