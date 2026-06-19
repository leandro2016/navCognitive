// React hooks: localStorage persistence and a drift-free countdown.
import { useState, useEffect, useRef } from "react";

export function useLocalStorage(key, defaultVal) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultVal;
    } catch { return defaultVal; }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }, [key, value]);

  return [value, setValue];
}

// Drift-free countdown: anchored to an end timestamp so long sessions
// (up to 30 min) don't accumulate setInterval drift. Preserves remaining
// time across pause/resume (does not restart from full duration).
export function useCountdown(seconds, active, onDone) {
  const [t, setT] = useState(seconds);
  const endRef = useRef(0);
  const ref = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // reset to a fresh full duration only when the `seconds` value changes
  useEffect(() => { setT(seconds); }, [seconds]);

  useEffect(() => {
    clearInterval(ref.current);
    if (!active) return;
    // resume from current `t` instead of restarting from `seconds`
    endRef.current = Date.now() + t * 1000;
    ref.current = setInterval(() => {
      const remaining = Math.round((endRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(ref.current);
        setT(0);
        onDoneRef.current();
        return;
      }
      setT(remaining);
    }, 250);
    return () => clearInterval(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, seconds]);

  return t;
}