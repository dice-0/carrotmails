import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem("cm-theme") as Theme | null;
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "light";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const t = getInitial();
    setTheme(t);
    apply(t);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      apply(next);
      try {
        window.localStorage.setItem("cm-theme", next);
      } catch {}
      return next;
    });
  };

  return { theme, toggle };
}
