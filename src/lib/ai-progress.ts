import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Progressive, professional loading copy for AI generation.
 * Keeps the loading state active while the server retries/falls back,
 * and blocks duplicate submissions while a run is in progress.
 */
export const AI_PROGRESS_STAGES = [
  { at: 0, label: "Generating your content..." },
  { at: 12_000, label: "Still generating... Please wait." },
  { at: 45_000, label: "Still generating... Almost there." },
] as const;

export function useAiRun() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>(AI_PROGRESS_STAGES[0].label);
  const inFlight = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clear, [clear]);

  /** Runs `fn` once — concurrent calls are ignored (no duplicate requests). */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setRunning(true);
      setStatus(AI_PROGRESS_STAGES[0].label);
      clear();
      for (const stage of AI_PROGRESS_STAGES.slice(1)) {
        timers.current.push(setTimeout(() => setStatus(stage.label), stage.at));
      }
      try {
        return await fn();
      } finally {
        clear();
        inFlight.current = false;
        setRunning(false);
      }
    },
    [clear],
  );

  return { running, status, run };
}
