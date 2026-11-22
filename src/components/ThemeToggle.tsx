"use client";

import { Moon, Sun } from "lucide-react";
import { toggleSiteTheme } from "@/lib/siteTheme";

export function ThemeToggle() {
  return (
    <button className="theme-toggle" type="button" onClick={toggleSiteTheme}>
      <Moon className="theme-toggle-moon" size={17} aria-hidden="true" />
      <Sun className="theme-toggle-sun" size={17} aria-hidden="true" />
      <span className="sr-only dark:hidden">切换到暗色主题</span>
      <span className="sr-only hidden dark:block">切换到浅色主题</span>
    </button>
  );
}
