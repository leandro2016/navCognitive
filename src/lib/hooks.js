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
// `resetKey` changes when a new question starts, forcing a full reset.
export function useCountdown(seconds, active, onDone, resetKey = 0) {
  const [t, setT] = useState(seconds);
  const endRef = useRef(0);
  const ref = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  // Marks a "fresh start" (new question / new duration) vs a resume from pause.
  // Set by the reset effect and consumed by the interval effect below.
  const freshRef = useRef(true);

  // reset to a fresh full duration when `seconds` OR `resetKey` changes.
  // Declared BEFORE the interval effect so freshRef is set first.
  useEffect(() => {
    setT(seconds);
    freshRef.current = true;
  }, [seconds, resetKey]);

  useEffect(() => {
    clearInterval(ref.current);
    if (!active) return;
    // On a fresh start use the full duration; on resume continue from `t`.
    const startFrom = freshRef.current ? seconds : t;
    freshRef.current = false;
    endRef.current = Date.now() + startFrom * 1000;
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
  }, [active, seconds, resetKey]);

  return t;
}