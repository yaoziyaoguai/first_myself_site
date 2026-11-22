export const siteThemeScript = `(()=>{let d=matchMedia("(prefers-color-scheme: dark)").matches;try{const t=localStorage.theme;if(t==="light"||t==="dark")d=t==="dark"}catch(e){if(e.name!=="SecurityError")throw e}document.documentElement.classList.toggle("dark",d)})()`;

export function toggleSiteTheme() {
  const root = document.documentElement;
  const dark = !root.classList.contains("dark");
  const apply = () => {
    root.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch (error) {
      if (!(error instanceof DOMException) ||
        (error.name !== "SecurityError" && error.name !== "QuotaExceededError")) throw error;
    }
  };

  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}
