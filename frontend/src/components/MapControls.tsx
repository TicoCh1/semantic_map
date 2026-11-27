import { GlassButton, GlassSwitch } from "@form-glass/react";
import { AlertCircle, Info } from "lucide-react";
import type { ReactNode } from "react";
import type { RemoteLogEntry } from "../api/types";
import { LogPanel } from "./LogPanel";

type Props = {
  dark: boolean; onDarkChange: (dark: boolean) => void;
  onIntro: () => void; introButton?: ReactNode;
  error?: string | null; logs: RemoteLogEntry[]; onClearLogs: () => void;
  children: ReactNode;
};

export function MapControls({ dark, onDarkChange, onIntro, introButton, children, error, logs, onClearLogs }: Props) {
  return <div className="sidebar-content">
    <div className="sidebar-top-bar">
      {introButton ?? <GlassButton className="secondary-button intro-button" onClick={onIntro}>
        <Info size={16} />Project intro
      </GlassButton>}
      <GlassSwitch className="theme-toggle" label="Dark mode" checked={dark} onChange={onDarkChange} />
    </div>
    {children}
    {error && <div className="error-panel" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
    <LogPanel entries={logs} onClear={onClearLogs} />
  </div>;
}
