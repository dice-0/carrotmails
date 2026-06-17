import { useEffect, useRef, useState } from "react";

// SSR-safe localStorage-backed state. Hydrates from storage on mount
// to avoid SSR/client markup mismatch, then writes back on every change.
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // ignore
    }
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota/serialization issues, ignore
    }
  }, [key, value]);

  return [value, setValue] as const;
}
