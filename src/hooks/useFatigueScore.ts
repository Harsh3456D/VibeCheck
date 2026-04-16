import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export type MentalState = "chill" | "focused" | "flow" | "frantic" | "critical";

export interface FatigueData {
  score: number;
  keystroke_velocity: number;
  backspace_ratio: number;
  is_simulated: boolean;
  mental_state: MentalState;
  calibration_progress: number;
  baseline_apm: number;
}

const POLL_INTERVAL = 2000; // 2 seconds

export function useFatigueScore() {
  const [data, setData] = useState<FatigueData>({
    score: 0,
    keystroke_velocity: 0,
    backspace_ratio: 0,
    is_simulated: true,
    mental_state: "chill",
    calibration_progress: 1.0,
    baseline_apm: 60,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await invoke<FatigueData>("get_fatigue_data");
      setData(result);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      setError(String(err));
      setIsLoading(false);
    }
  }, []);

  const setTrackingMode = useCallback(async (mode: "simulated" | "real") => {
    try {
      await invoke("set_tracking_mode", { mode });
      await fetchData();
    } catch (err) {
      setError(String(err));
    }
  }, [fetchData]);

  const resetBaseline = useCallback(async () => {
    try {
      await invoke("reset_baseline");
      await fetchData();
    } catch (err) {
      setError(String(err));
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData]);

  return { data, isLoading, error, setTrackingMode, resetBaseline };
}
