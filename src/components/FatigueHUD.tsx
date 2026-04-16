import type { FatigueData, MentalState } from "../hooks/useFatigueScore";

interface FatigueHUDProps {
  data: FatigueData;
  onToggleMode: () => void;
}

// ── Mental state visual config ──

interface StateConfig {
  label: string;
  cssClass: string;
  color: string;
  icon: string;
}

const STATE_CONFIG: Record<MentalState, StateConfig> = {
  chill: {
    label: "Chill",
    cssClass: "score-low",
    color: "var(--color-green)",
    icon: "🧘",
  },
  focused: {
    label: "Focused",
    cssClass: "score-focused",
    color: "var(--color-neon-cyan)",
    icon: "🎯",
  },
  flow: {
    label: "In The Zone",
    cssClass: "score-flow",
    color: "var(--color-flow)",
    icon: "⚡",
  },
  frantic: {
    label: "Frantic",
    cssClass: "score-frantic",
    color: "var(--color-red)",
    icon: "🔥",
  },
  critical: {
    label: "Critical",
    cssClass: "score-critical",
    color: "var(--color-neon-magenta)",
    icon: "🚨",
  },
};

export default function FatigueHUD({ data, onToggleMode }: FatigueHUDProps) {
  const scorePercent = Math.round(data.score * 100);
  const config = STATE_CONFIG[data.mental_state];
  const isCalibrating = !data.is_simulated && data.calibration_progress < 1.0;
  const calibPercent = Math.round(data.calibration_progress * 100);

  return (
    <div className="content">
      {/* Mental State Card */}
      <div className="card" id="fatigue-score-card">
        <div className="card-header">
          <span className="card-label">Mental State</span>
          <span className={`card-label ${config.cssClass}`}>
            {config.icon} {config.label}
          </span>
        </div>
        <div className={`card-value ${config.cssClass}`}>{scorePercent}%</div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${scorePercent}%`,
              background: `linear-gradient(90deg, ${config.color}88, ${config.color})`,
              boxShadow: `0 0 8px ${config.color}66`,
            }}
          />
        </div>
        <div className="status-row">
          <div
            className="status-dot"
            style={{
              background: config.color,
              boxShadow: `0 0 6px ${config.color}`,
            }}
          />
          <span className="status-text">
            {data.is_simulated
              ? "Simulated telemetry"
              : isCalibrating
              ? `Calibrating baseline… ${calibPercent}%`
              : "Live tracking · baseline set"}
          </span>
        </div>
      </div>

      {/* Calibration Progress (only in real mode during calibration) */}
      {isCalibrating && (
        <div className="card calibration-card" id="calibration-card">
          <div className="card-header">
            <span className="card-label">Baseline Calibration</span>
            <span className="card-label score-focused">{calibPercent}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${calibPercent}%`,
                background: "linear-gradient(90deg, var(--color-neon-cyan)88, var(--color-neon-cyan))",
                boxShadow: "0 0 8px var(--color-neon-cyan)66",
              }}
            />
          </div>
          <p className="calibration-hint">
            Type naturally for ~5 minutes to establish your personal baseline.
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-item" id="keystroke-velocity">
          <div className="stat-label">Keystroke Velocity</div>
          <div className="stat-value">
            {data.keystroke_velocity.toFixed(1)}
            <span className="stat-unit">k/s</span>
          </div>
        </div>
        <div className="stat-item" id="backspace-ratio">
          <div className="stat-label">Backspace Rate</div>
          <div className="stat-value">
            {(data.backspace_ratio * 100).toFixed(1)}
            <span className="stat-unit">%</span>
          </div>
        </div>
        {!data.is_simulated && data.calibration_progress >= 1.0 && (
          <div className="stat-item" id="baseline-apm">
            <div className="stat-label">Baseline APM</div>
            <div className="stat-value">
              {data.baseline_apm.toFixed(0)}
              <span className="stat-unit">apm</span>
            </div>
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="mode-toggle" id="mode-toggle">
        <div>
          <div className="mode-label">Tracking Mode</div>
          <span className={`mode-badge ${data.is_simulated ? "simulated" : "real"}`}>
            {data.is_simulated ? "SIMULATED" : "REAL-TIME"}
          </span>
        </div>
        <button
          className={`toggle-switch ${!data.is_simulated ? "active" : ""}`}
          onClick={onToggleMode}
          title={data.is_simulated ? "Switch to real tracking" : "Switch to simulation"}
          id="btn-toggle-mode"
        />
      </div>
    </div>
  );
}
