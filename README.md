# VibeCheck — Floating Sentinel

> A zero-latency, privacy-first floating desktop sentinel that tracks user fatigue via system telemetry and visualizes cognitive state through a dynamic 3D neon ribbon.

![Stack](https://img.shields.io/badge/Tauri_2.0-24C8DB?style=flat&logo=tauri&logoColor=white)
![Stack](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![Stack](https://img.shields.io/badge/Three.js-000000?style=flat&logo=three.js&logoColor=white)
![Stack](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)

---

##  Features

- **Floating Widget** — Frameless, transparent, always-on-top desktop overlay
- **3D Neon Ribbon** — React Three Fiber shader with Simplex noise wave physics and Bloom glow
- **Fatigue Tracking** — Real-time cognitive load detection via keystroke velocity + backspace frequency
- **Simulation Mode** — Default demo mode with organic wave patterns (no system hooks required)
- **Real-Time Mode** — Toggle to enable `rdev` global keyboard listener for live telemetry
- **Smart Intervention** — Animated popup alert when cognitive overload is detected (score > 85%)
- **Corner Snapping** — Draggable window that defaults to top-right, snaps to nearest corner on release
- **Liquid Glass UI** — Dark neumorphism with backdrop blur, inner glows, and neon accents

---

##  Architecture

```
┌──────────────────────────────────────────┐
│              Tauri Shell                 │
│  Frameless · Transparent · Always On Top │
├──────────────────────────────────────────┤
│         Rust Backend (Telemetry)         │
│  rdev listener → Fatigue Score Engine    │
│  Simulation mode (default) / Real mode   │
├──────────────────────────────────────────┤
│         React Frontend (Vite + TS)       │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ NeonRibbon   │  │  FatigueHUD      │  │
│  │ (R3F+Shader) │  │  (Stats Cards)   │  │
│  └─────────────┘  └──────────────────┘  │
│  ┌─────────────────────────────────────┐│
│  │ InterventionPopup (Framer Motion)   ││
│  └─────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

---

##  Prerequisites

Before running VibeCheck, ensure you have the following installed:

### 1. Rust Toolchain
```powershell
# Install Rust via rustup
winget install Rustlang.Rustup --accept-package-agreements

# Verify installation
rustc --version
cargo --version
```

### 2. Node.js (v18+)
```powershell
# Install Node.js
winget install OpenJS.NodeJS.LTS --accept-package-agreements

# Verify
node --version
npm --version
```

### 3. Visual Studio Build Tools (MSVC Linker)

Tauri requires the MSVC C++ toolchain for compiling native code on Windows.

```powershell
# Install VS Build Tools with C++ workload
winget install Microsoft.VisualStudio.2022.BuildTools `
  --accept-package-agreements `
  --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

> **Note:** This is a ~2GB download. The installer runs silently and may take 5-10 minutes.

### 4. WebView2 Runtime
Windows 10/11 typically includes this. If not:
```powershell
winget install Microsoft.EdgeWebView2Runtime
```

---

##  Quick Start (Development)

### 1. Clone & Install

```powershell
cd D:\Projects\VibeCheck
npm install
```

### 2. Set Up MSVC Environment

Before running Tauri, you need to configure the MSVC environment in your terminal session:

```powershell
# Run the setup script (configures PATH, LIB, INCLUDE)
. .\setup-env.ps1
```

> **What this does:** Points Rust's linker to the Visual Studio Build Tools binaries. This is required once per terminal session.

### 3. Launch Dev Mode

```powershell
npm run tauri dev
```

This will:
1. Start the Vite dev server on `http://localhost:1420`
2. Compile the Rust backend
3. Launch the VibeCheck floating widget

> **First run** will take 2-5 minutes to compile all Rust dependencies. Subsequent runs are near-instant thanks to incremental compilation.

---

##  Usage

### Default: Simulation Mode
The app launches in **simulation mode** by default. It generates organic, wave-like fatigue data to demonstrate the UI without requiring any system permissions.

### Toggle Real-Time Tracking
Click the **toggle switch** at the bottom of the widget to enable real-time mode. This activates the `rdev` global keyboard listener which tracks:
- **Keystroke Velocity** — Keys per second with variance analysis
- **Backspace Frequency** — Ratio of correction keys to total keystrokes

>  **Privacy Note:** Real-time mode captures keyboard event *timestamps* only — never the actual key values. No data is stored or transmitted.

### Understanding the Score

| Score Range | Status | Visual |
|---|---|---|
| 0% – 30% | **Chill** | Slow blue waves, green indicator |
| 30% – 50% | **Focused** | Medium tempo, blue shifting |
| 50% – 70% | **Elevated** | Faster waves, amber indicator |
| 70% – 85% | **High Friction** | Rapid purple waves, red indicator |
| 85% – 100% | **Critical** | Chaotic magenta, intervention popup |

### Intervention Alert
When the score exceeds **85%**, a slide-up notification recommends a 5-minute cooldown. It auto-dismisses after 12 seconds and has a 30-second cooldown before re-triggering.

---

##  Building for Production (.exe)

### Step-by-Step Build Guide

#### 1. Prepare the Environment

```powershell
# Navigate to project root
cd D:\Projects\VibeCheck

# Set up MSVC environment
. .\setup-env.ps1

# Verify everything is in order
rustc --version   # Should show 1.77+
node --version    # Should show v18+
npm --version     # Should show 9+
```

#### 2. Run the Production Build

```powershell
npm run tauri build
```

This command will:
1. Run `vite build` to create an optimized frontend bundle in `./dist/`
2. Compile the Rust backend in release mode (with optimizations)
3. Bundle everything into a standalone Windows executable
4. Generate installers (MSI + NSIS)

> **Build time:** First production build takes 5-15 minutes. The Rust compiler applies heavy optimizations in release mode.

#### 3. Locate the Output

After a successful build, your artifacts will be in:

```
src-tauri/target/release/
├── VibeCheck.exe                    ← Standalone executable
└── bundle/
    ├── msi/
    │   └── VibeCheck_0.1.0_x64_en-US.msi   ← MSI installer
    └── nsis/
        └── VibeCheck_0.1.0_x64-setup.exe    ← NSIS installer
```

- **`VibeCheck.exe`** — The standalone app binary. Requires WebView2 runtime on the target machine.
- **`.msi`** — Standard Windows installer. Good for enterprise deployment.
- **`nsis-setup.exe`** — NSIS installer that bundles the WebView2 bootstrapper (recommended for distribution).

#### 4. Distribution Notes

- The **NSIS installer** is recommended for distribution as it auto-installs WebView2 if missing
- The app identifier is `com.vibecheck.sentinel` — change in `tauri.conf.json` if needed
- To customize the app icon, replace the files in `src-tauri/icons/`
- For code signing, see [Tauri's signing guide](https://v2.tauri.app/distribute/sign/windows/)

#### 5. Troubleshooting Build Issues

| Issue | Fix |
|---|---|
| `link.exe not found` | Run `. .\setup-env.ps1` before building |
| `WebView2 not found` | Install via `winget install Microsoft.EdgeWebView2Runtime` |
| Frontend build fails | Run `npm run build` standalone to debug |
| Rust compile errors | Run `cargo check` in `src-tauri/` to see detailed errors |
| Icon errors | Ensure all icon files exist in `src-tauri/icons/` |

---

##  Project Structure

```
VibeCheck/
├── index.html                          # HTML entry point
├── package.json                        # Node dependencies & scripts
├── vite.config.ts                      # Vite dev server configuration
├── tsconfig.json                       # TypeScript configuration
├── setup-env.ps1                       # MSVC environment setup script
├── src/
│   ├── main.tsx                        # React entry point
│   ├── App.tsx                         # Main app shell
│   ├── App.css                         # Global styles (Cyber-Zen theme)
│   ├── vite-env.d.ts                   # Vite type declarations
│   ├── components/
│   │   ├── NeonRibbon.tsx              # R3F 3D canvas + shader ribbon
│   │   ├── FatigueHUD.tsx              # Stats overlay + mode toggle
│   │   ├── InterventionPopup.tsx       # Motion slide-up alert
│   │   └── TitleBar.tsx                # Custom drag titlebar
│   ├── shaders/
│   │   ├── ribbon.vert.ts              # Vertex shader (Simplex noise)
│   │   └── ribbon.frag.ts              # Fragment shader (color lerp)
│   └── hooks/
│       └── useFatigueScore.ts          # Tauri backend polling hook
├── src-tauri/
│   ├── tauri.conf.json                 # Tauri window & bundle config
│   ├── Cargo.toml                      # Rust dependencies
│   ├── build.rs                        # Tauri build script
│   ├── capabilities/
│   │   └── default.json                # Window permissions
│   ├── icons/                          # App icons (all sizes)
│   └── src/
│       ├── lib.rs                      # Tauri app setup + commands
│       ├── main.rs                     # Binary entry point
│       └── telemetry.rs                # Fatigue engine + rdev listener
└── README.md                           # This file
```

---

##  Technical Details

### Fatigue Score Formula
```
score = clamp(0.4 × velocity_variance + 0.6 × backspace_ratio, 0.0, 1.0)
```

- **Velocity Variance:** Coefficient of variation of inter-keystroke intervals. Higher variance = more erratic typing = higher cognitive friction.
- **Backspace Ratio:** `backspace_count / total_keystrokes` in a 60-second rolling window. Higher ratio = more corrections = more fatigue.

### Shader Pipeline
- **Vertex Shader:** 3-octave Simplex 3D noise displacing a high-subdivision plane (128×48 segments)
- **Fragment Shader:** Dual-gradient color space (Royal Blue↔Cyan for calm, Purple↔Magenta for stress) with edge glow and shimmer
- **Post-processing:** Bloom effect (luminance threshold 0.2, intensity 1.8) via `@react-three/postprocessing`

### Window Behavior
- Defaults to **top-right** corner of the primary monitor
- Frameless, transparent, always-on-top
- Draggable via custom title bar region using `data-tauri-drag-region`

---

##  License

MIT — Built by Harsh and caffeine.
