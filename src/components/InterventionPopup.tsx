import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface InterventionPopupProps {
  fatigueScore: number;
}

const TRIGGER_THRESHOLD = 0.85;
const AUTO_DISMISS_MS = 12000;
const COOLDOWN_MS = 30000; // Don't re-trigger for 30s after dismissal

export default function InterventionPopup({ fatigueScore }: InterventionPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [lastDismissed, setLastDismissed] = useState(0);

  useEffect(() => {
    const now = Date.now();
    if (fatigueScore > TRIGGER_THRESHOLD && !isVisible && now - lastDismissed > COOLDOWN_MS) {
      setIsVisible(true);
    } else if (fatigueScore <= TRIGGER_THRESHOLD * 0.9 && isVisible) {
      // Auto-hide if score drops well below threshold
      setIsVisible(false);
      setLastDismissed(Date.now());
    }
  }, [fatigueScore, isVisible, lastDismissed]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      setIsVisible(false);
      setLastDismissed(Date.now());
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [isVisible]);

  const handleDismiss = () => {
    setIsVisible(false);
    setLastDismissed(Date.now());
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="intervention-overlay"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{
            type: "spring",
            damping: 25,
            stiffness: 300,
          }}
        >
          <div className="intervention-card" onClick={handleDismiss} id="intervention-popup">
            <div className="intervention-header">
              <span className="intervention-icon">⚡</span>
              <span className="intervention-title">Cognitive Overload Detected</span>
            </div>
            <p className="intervention-message">
              Focus efficiency dropping. Erratic input patterns and elevated correction rate suggest
              cognitive fatigue. Recommend a 5-minute cooldown to restore baseline performance.
            </p>
            <p className="intervention-dismiss">Click to dismiss · Auto-closes in 12s</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
