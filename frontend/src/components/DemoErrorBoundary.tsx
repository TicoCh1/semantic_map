import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportDemoMonitorEvent } from "../state/demoMonitor";

type Props = {
  children: ReactNode;
};

type State = {
  failed: boolean;
  message: string;
};

export class DemoErrorBoundary extends Component<Props, State> {
  state: State = {
    failed: false,
    message: ""
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      failed: true,
      message: error.message || "Frontend crashed"
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportDemoMonitorEvent({
      severity: "critical",
      code: "frontend_react_error_boundary",
      message: error.message || "React render failed.",
      details: {
        name: error.name,
        stack: error.stack?.slice(0, 4000),
        component_stack: info.componentStack?.slice(0, 4000)
      }
    });
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="boot-screen">
          <div className="boot-panel">
            <strong>Semantic Map</strong>
            <span>{this.state.message}</span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
