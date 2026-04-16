use parking_lot::Mutex;
use rand::Rng;
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

// ─── Constants ───────────────────────────────────────────────────────────────

/// Rolling window: max events to keep
const WINDOW_SIZE: usize = 300;
/// Rolling window duration in seconds
const WINDOW_DURATION_SECS: u64 = 60;
/// Calibration period: 5 minutes of typing to establish personal baseline
const CALIBRATION_DURATION_SECS: u64 = 300;
/// Minimum events needed before calibration can complete
const CALIBRATION_MIN_EVENTS: usize = 50;
/// Sustained-state analysis window: last 30 seconds
const SUSTAINED_WINDOW_SECS: u64 = 30;
/// APM threshold multiplier above baseline to consider "high APM"
const HIGH_APM_MULTIPLIER: f64 = 1.4;
/// Backspace ratio threshold to distinguish Flow from Frantic
const FLOW_BACKSPACE_CEILING: f64 = 0.08;
/// Backspace ratio threshold above which is clearly Frantic
const FRANTIC_BACKSPACE_FLOOR: f64 = 0.15;
/// Minimum sustained seconds of high-APM before triggering Flow/Frantic
const SUSTAINED_MIN_SECS: f64 = 10.0;

// ─── Data Structures ─────────────────────────────────────────────────────────

/// Represents a single keystroke event
#[derive(Clone, Debug)]
struct KeyEvent {
    timestamp: Instant,
    is_backspace: bool,
}

/// The user's mental state, determined by the heuristic engine
#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MentalState {
    /// Score < 0.3: relaxed, low activity
    Chill,
    /// Normal typing, score 0.3–0.6
    Focused,
    /// Sustained high APM + low errors: deep work
    Flow,
    /// Sustained high APM + high errors: panic mode
    Frantic,
    /// Score > 0.85: critical overload
    Critical,
}

/// Personal baseline calibration data
#[derive(Debug)]
struct Baseline {
    /// Has the baseline been established?
    calibrated: bool,
    /// When calibration started (first keypress in real mode)
    started_at: Option<Instant>,
    /// Accumulated APM samples during calibration
    apm_samples: Vec<f64>,
    /// Accumulated backspace ratio samples during calibration
    backspace_samples: Vec<f64>,
    /// The user's natural APM (actions per minute)
    natural_apm: f64,
    /// The user's natural backspace ratio
    natural_backspace_ratio: f64,
    /// Calibration progress 0.0–1.0
    progress: f32,
}

impl Baseline {
    fn new() -> Self {
        Self {
            calibrated: false,
            started_at: None,
            apm_samples: Vec::with_capacity(64),
            backspace_samples: Vec::with_capacity(64),
            natural_apm: 60.0,   // Sensible default: 1 key/sec
            natural_backspace_ratio: 0.05,
            progress: 0.0,
        }
    }

    fn reset(&mut self) {
        self.calibrated = false;
        self.started_at = None;
        self.apm_samples.clear();
        self.backspace_samples.clear();
        self.progress = 0.0;
    }
}

/// Shared telemetry state between the listener thread and Tauri commands
#[derive(Debug)]
pub struct TelemetryState {
    events: VecDeque<KeyEvent>,
    baseline: Baseline,
    // Computed metrics
    current_apm: f64,
    current_backspace_ratio: f64,
    keystroke_velocity: f32,  // keys per second (for display)
    fatigue_score: f32,
    mental_state: MentalState,
    // Sustained state tracking
    high_apm_since: Option<Instant>,
    // Mode
    is_simulated: bool,
    sim_time: f64,
}

/// Data returned to the frontend
#[derive(Serialize, Clone, Debug)]
pub struct FatigueData {
    pub score: f32,
    pub keystroke_velocity: f32,
    pub backspace_ratio: f32,
    pub is_simulated: bool,
    pub mental_state: MentalState,
    pub calibration_progress: f32,
    pub baseline_apm: f32,
}

// ─── Implementation ──────────────────────────────────────────────────────────

impl TelemetryState {
    pub fn new() -> Self {
        Self {
            events: VecDeque::with_capacity(WINDOW_SIZE),
            baseline: Baseline::new(),
            current_apm: 0.0,
            current_backspace_ratio: 0.0,
            keystroke_velocity: 0.0,
            fatigue_score: 0.0,
            mental_state: MentalState::Chill,
            high_apm_since: None,
            is_simulated: true,
            sim_time: 0.0,
        }
    }

    /// Record a new key event
    pub fn record_key(&mut self, is_backspace: bool) {
        let now = Instant::now();

        // Start calibration timer on first real keypress
        if !self.is_simulated && self.baseline.started_at.is_none() {
            self.baseline.started_at = Some(now);
        }

        // Prune events older than the window
        let cutoff = now - Duration::from_secs(WINDOW_DURATION_SECS);
        while let Some(front) = self.events.front() {
            if front.timestamp < cutoff {
                self.events.pop_front();
            } else {
                break;
            }
        }

        if self.events.len() >= WINDOW_SIZE {
            self.events.pop_front();
        }

        self.events.push_back(KeyEvent {
            timestamp: now,
            is_backspace,
        });

        self.recalculate(now);
    }

    /// Core recalculation: APM, backspace ratio, baseline calibration, fatigue score, mental state
    fn recalculate(&mut self, now: Instant) {
        if self.events.len() < 3 {
            self.fatigue_score = 0.0;
            self.keystroke_velocity = 0.0;
            self.current_apm = 0.0;
            self.current_backspace_ratio = 0.0;
            self.mental_state = MentalState::Chill;
            return;
        }

        // ── Compute current APM & backspace ratio ──
        let window_start = self.events.front().unwrap().timestamp;
        let window_duration_secs = now.duration_since(window_start).as_secs_f64().max(1.0);
        let total_keys = self.events.len() as f64;
        let backspaces = self.events.iter().filter(|e| e.is_backspace).count() as f64;

        self.current_apm = (total_keys / window_duration_secs) * 60.0;
        self.current_backspace_ratio = backspaces / total_keys;
        self.keystroke_velocity = (total_keys / window_duration_secs).min(30.0) as f32;

        // ── Calibration phase ──
        if !self.baseline.calibrated {
            if let Some(start) = self.baseline.started_at {
                let elapsed = now.duration_since(start).as_secs();
                self.baseline.progress =
                    (elapsed as f32 / CALIBRATION_DURATION_SECS as f32).min(1.0);

                // Collect samples every ~2 seconds (when we have enough data)
                if self.events.len() >= 10 {
                    self.baseline.apm_samples.push(self.current_apm);
                    self.baseline.backspace_samples.push(self.current_backspace_ratio);
                }

                // Complete calibration when time is up and we have enough samples
                if elapsed >= CALIBRATION_DURATION_SECS
                    && self.baseline.apm_samples.len() >= CALIBRATION_MIN_EVENTS
                {
                    // Compute median (more robust than mean against outliers)
                    self.baseline.apm_samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
                    self.baseline.backspace_samples.sort_by(|a, b| a.partial_cmp(b).unwrap());

                    let mid = self.baseline.apm_samples.len() / 2;
                    self.baseline.natural_apm = self.baseline.apm_samples[mid];
                    self.baseline.natural_backspace_ratio = self.baseline.backspace_samples[mid];

                    self.baseline.calibrated = true;
                    self.baseline.progress = 1.0;
                    log::info!(
                        "Baseline calibrated: APM={:.1}, backspace_ratio={:.3}",
                        self.baseline.natural_apm,
                        self.baseline.natural_backspace_ratio
                    );
                }
            }
        }

        // ── Compute fatigue score relative to baseline ──
        let base_apm = self.baseline.natural_apm.max(10.0);
        let base_bs = self.baseline.natural_backspace_ratio;

        // APM deviation: how far above/below baseline
        // Negative means slower than usual (could be tired), positive means faster
        let apm_ratio = self.current_apm / base_apm;

        // Keystroke variance (erratic typing indicator)
        let intervals: Vec<f64> = self
            .events
            .iter()
            .zip(self.events.iter().skip(1))
            .map(|(a, b)| b.timestamp.duration_since(a.timestamp).as_secs_f64())
            .collect();

        let mean_interval: f64 = intervals.iter().sum::<f64>() / intervals.len() as f64;
        let variance: f64 = intervals
            .iter()
            .map(|&i| (i - mean_interval).powi(2))
            .sum::<f64>()
            / intervals.len() as f64;
        let cv = if mean_interval > 0.0 {
            (variance.sqrt() / mean_interval).min(2.0)
        } else {
            0.0
        };
        let erratic_score = (cv as f32).min(1.0);

        // Backspace deviation from personal baseline
        let bs_deviation = (self.current_backspace_ratio - base_bs).max(0.0);
        let backspace_score = (bs_deviation as f32 / 0.20).min(1.0); // 20% above baseline = max

        // Combined fatigue score (baseline-relative)
        self.fatigue_score = (0.35 * erratic_score + 0.65 * backspace_score).clamp(0.0, 1.0);

        // ── Sustained APM analysis → Flow vs Frantic ──
        let is_high_apm = apm_ratio > HIGH_APM_MULTIPLIER;

        if is_high_apm {
            if self.high_apm_since.is_none() {
                self.high_apm_since = Some(now);
            }
        } else {
            self.high_apm_since = None;
        }

        let sustained_high = if let Some(since) = self.high_apm_since {
            now.duration_since(since).as_secs_f64() >= SUSTAINED_MIN_SECS
        } else {
            false
        };

        // ── Determine mental state ──
        // Get recent backspace ratio (last SUSTAINED_WINDOW_SECS)
        let recent_cutoff = now - Duration::from_secs(SUSTAINED_WINDOW_SECS);
        let recent_events: Vec<&KeyEvent> = self
            .events
            .iter()
            .filter(|e| e.timestamp >= recent_cutoff)
            .collect();

        let recent_bs_ratio = if recent_events.len() >= 5 {
            let bs = recent_events.iter().filter(|e| e.is_backspace).count() as f64;
            bs / recent_events.len() as f64
        } else {
            self.current_backspace_ratio
        };

        self.mental_state = if self.fatigue_score > 0.85 {
            MentalState::Critical
        } else if sustained_high {
            if recent_bs_ratio <= FLOW_BACKSPACE_CEILING {
                // High APM + very low errors = Flow state
                // Override fatigue score downward — the user is dialed in
                self.fatigue_score = (self.fatigue_score * 0.3).min(0.25);
                MentalState::Flow
            } else if recent_bs_ratio >= FRANTIC_BACKSPACE_FLOOR {
                // High APM + high errors = Frantic
                // Boost fatigue score — this is stressful
                self.fatigue_score = (self.fatigue_score + 0.2).min(1.0);
                MentalState::Frantic
            } else {
                // In between: use the normal score-based states
                if self.fatigue_score < 0.3 {
                    MentalState::Chill
                } else {
                    MentalState::Focused
                }
            }
        } else if self.fatigue_score < 0.3 {
            MentalState::Chill
        } else {
            MentalState::Focused
        };
    }

    /// Generate simulated fatigue data that cycles through ALL mental states
    pub fn simulate(&mut self) -> FatigueData {
        self.sim_time += 0.05;

        let mut rng = rand::thread_rng();

        // Cycle through states with longer dwell times for each
        // Full cycle: ~200 ticks = ~400 seconds at 2s poll rate
        let cycle = (self.sim_time * 0.08) % 5.0;

        let (score, state, velocity, backspace) = if cycle < 1.0 {
            // Chill phase
            let s = 0.1 + 0.1 * (self.sim_time * 0.5).sin().abs() as f32;
            let v = 2.0 + rng.gen_range(-0.5_f32..0.5);
            let b = 0.02 + rng.gen_range(-0.01_f32..0.01);
            (s, MentalState::Chill, v, b)
        } else if cycle < 2.0 {
            // Focused phase
            let s = 0.35 + 0.15 * (self.sim_time * 0.7).sin() as f32;
            let v = 5.0 + rng.gen_range(-1.0_f32..1.0);
            let b = 0.06 + rng.gen_range(-0.02_f32..0.02);
            (s, MentalState::Focused, v, b)
        } else if cycle < 3.0 {
            // Flow phase — high speed, very low errors
            let s = 0.15 + 0.05 * (self.sim_time * 0.3).sin().abs() as f32;
            let v = 12.0 + rng.gen_range(-1.0_f32..1.0);
            let b = 0.03 + rng.gen_range(-0.01_f32..0.01);
            (s, MentalState::Flow, v, b)
        } else if cycle < 4.0 {
            // Frantic phase — high speed, high errors
            let s = 0.72 + 0.1 * (self.sim_time * 1.5).sin().abs() as f32;
            let v = 14.0 + rng.gen_range(-2.0_f32..2.0);
            let b = 0.25 + rng.gen_range(-0.05_f32..0.05);
            (s, MentalState::Frantic, v, b)
        } else {
            // Critical phase
            let s = 0.88 + 0.08 * (self.sim_time * 2.0).sin().abs() as f32;
            let v = 10.0 + rng.gen_range(-3.0_f32..3.0);
            let b = 0.35 + rng.gen_range(-0.05_f32..0.05);
            (s, MentalState::Critical, v, b)
        };

        FatigueData {
            score: score.clamp(0.0, 1.0),
            keystroke_velocity: velocity.max(0.0),
            backspace_ratio: backspace.clamp(0.0, 0.5),
            is_simulated: true,
            mental_state: state,
            calibration_progress: 1.0,
            baseline_apm: 60.0,
        }
    }

    /// Get real fatigue data
    pub fn get_real_data(&self) -> FatigueData {
        FatigueData {
            score: self.fatigue_score,
            keystroke_velocity: self.keystroke_velocity,
            backspace_ratio: self.current_backspace_ratio as f32,
            is_simulated: false,
            mental_state: self.mental_state,
            calibration_progress: self.baseline.progress,
            baseline_apm: self.baseline.natural_apm as f32,
        }
    }
}

// ─── Thread-Safe Wrappers ────────────────────────────────────────────────────

pub type SharedState = Arc<Mutex<TelemetryState>>;
pub type ListenerActive = Arc<AtomicBool>;

/// Start the global keyboard listener in a background thread
/// Filters out OS auto-repeat and throttles backspace to prevent false spikes
pub fn start_keyboard_listener(state: SharedState, active: ListenerActive) {
    std::thread::spawn(move || {
        log::info!("Starting global keyboard listener...");
        let state_clone = state.clone();
        let active_clone = active.clone();

        // ── Anti-repeat state ──
        // Track which keys are currently physically held down.
        // A key is "held" after KeyPress until we see a KeyRelease for it.
        use std::collections::HashSet;
        use std::cell::RefCell;

        let held_keys: RefCell<HashSet<rdev::Key>> = RefCell::new(HashSet::new());
        // Backspace throttle: timestamp of last registered backspace
        let last_backspace = RefCell::new(Instant::now() - Duration::from_secs(10));

        /// Max backspace registrations per second
        const BACKSPACE_MAX_PER_SEC: f64 = 3.0;
        let backspace_min_interval = Duration::from_secs_f64(1.0 / BACKSPACE_MAX_PER_SEC);

        let callback = move |event: rdev::Event| {
            if !active_clone.load(Ordering::Relaxed) {
                return;
            }

            match event.event_type {
                rdev::EventType::KeyPress(key) => {
                    let mut held = held_keys.borrow_mut();

                    // If the key is already held, this is an OS auto-repeat → ignore
                    if held.contains(&key) {
                        return;
                    }
                    held.insert(key);
                    drop(held); // Release borrow before locking state

                    let is_backspace = matches!(key, rdev::Key::Backspace | rdev::Key::Delete);

                    if is_backspace {
                        // Throttle backspace: skip if too soon after last one
                        let mut last_bs = last_backspace.borrow_mut();
                        let now = Instant::now();
                        if now.duration_since(*last_bs) < backspace_min_interval {
                            return;
                        }
                        *last_bs = now;
                    }

                    state_clone.lock().record_key(is_backspace);
                }
                rdev::EventType::KeyRelease(key) => {
                    // Mark the key as released so the next KeyPress is counted
                    held_keys.borrow_mut().remove(&key);
                }
                _ => {} // Ignore mouse events etc.
            }
        };

        if let Err(error) = rdev::listen(callback) {
            log::error!("rdev listener error: {:?}", error);
        }
    });
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_fatigue_data(state: tauri::State<'_, SharedState>) -> FatigueData {
    let mut state = state.lock();
    if state.is_simulated {
        state.simulate()
    } else {
        state.get_real_data()
    }
}

#[tauri::command]
pub fn set_tracking_mode(
    mode: String,
    state: tauri::State<'_, SharedState>,
    active: tauri::State<'_, ListenerActive>,
) -> bool {
    let mut telemetry = state.lock();
    match mode.as_str() {
        "real" => {
            telemetry.is_simulated = false;
            telemetry.baseline.reset(); // Reset baseline for fresh calibration
            active.store(true, Ordering::Relaxed);
            log::info!("Switched to REAL tracking mode — calibration started");
            true
        }
        "simulated" => {
            telemetry.is_simulated = true;
            active.store(false, Ordering::Relaxed);
            log::info!("Switched to SIMULATED tracking mode");
            true
        }
        _ => false,
    }
}

#[tauri::command]
pub fn get_tracking_mode(state: tauri::State<'_, SharedState>) -> String {
    let state = state.lock();
    if state.is_simulated {
        "simulated".to_string()
    } else {
        "real".to_string()
    }
}

#[tauri::command]
pub fn reset_baseline(state: tauri::State<'_, SharedState>) {
    let mut state = state.lock();
    state.baseline.reset();
    log::info!("Baseline reset — recalibration will begin on next keypress");
}
