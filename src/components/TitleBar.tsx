import { getCurrentWindow } from "@tauri-apps/api/window";

export default function TitleBar() {
  const appWindow = getCurrentWindow();

  const handleMinimize = () => appWindow.minimize();
  const handleClose = () => appWindow.close();

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-left" data-tauri-drag-region>
        <div className="titlebar-logo" />
        <span className="titlebar-title" data-tauri-drag-region>VibeCheck</span>
      </div>
      <div className="titlebar-controls">
        <button
          className="titlebar-btn"
          onClick={handleMinimize}
          title="Minimize"
          id="btn-minimize"
        >
          ─
        </button>
        <button
          className="titlebar-btn close"
          onClick={handleClose}
          title="Close"
          id="btn-close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
