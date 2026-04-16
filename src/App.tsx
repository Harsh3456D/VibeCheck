import { useCallback } from "react";
import TitleBar from "./components/TitleBar";
import NeonRibbon from "./components/NeonRibbon";
import FatigueHUD from "./components/FatigueHUD";
import InterventionPopup from "./components/InterventionPopup";
import { useFatigueScore } from "./hooks/useFatigueScore";

export default function App() {
  const { data, setTrackingMode } = useFatigueScore();

  const handleToggleMode = useCallback(() => {
    const newMode = data.is_simulated ? "real" : "simulated";
    setTrackingMode(newMode);
  }, [data.is_simulated, setTrackingMode]);

  return (
    <div className="app-container">
      <TitleBar />
      <NeonRibbon fatigueScore={data.score} mentalState={data.mental_state} />
      <FatigueHUD data={data} onToggleMode={handleToggleMode} />
      <InterventionPopup fatigueScore={data.score} />
    </div>
  );
}
