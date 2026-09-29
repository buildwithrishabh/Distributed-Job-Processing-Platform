import { Component } from "react";

import { Button } from "../ui/Button.jsx";
import { CodeBlock } from "../ui/Code.jsx";
import { Icons } from "../ui/Icons.jsx";

/**
 * Top-level error boundary.
 *
 * A render error in one view should degrade to a recoverable screen with the
 * stack trace available, not a blank page. The stack is shown behind a
 * disclosure because it is useful in development and noise in production.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Keep the console trail; this is the only place a render error is logged.
    console.error("[ui] unhandled render error:", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash">
        <div className="crash__inner">
          <div className="gate__icon" style={{ color: "var(--danger-text)", background: "var(--danger-soft)", borderColor: "var(--danger-border)" }}>
            <Icons.alert size={28} />
          </div>

          <h1 className="gate__title">Something broke in the interface</h1>
          <p className="gate__desc">
            This is a rendering fault in the dashboard, not necessarily a problem with the job queue.
            Your jobs and the worker processes are unaffected.
          </p>

          <div className="row" style={{ justifyContent: "center" }}>
            <Button variant="secondary" onClick={this.handleReset} icon={<Icons.retry size={15} />}>
              Try again
            </Button>
            <Button variant="ghost" onClick={this.handleReload}>
              Reload the app
            </Button>
          </div>

          <details style={{ width: "100%", textAlign: "left" }}>
            <summary
              style={{
                cursor: "pointer",
                fontSize: "var(--text-sm)",
                color: "var(--text-tertiary)",
                marginBottom: "var(--space-3)",
              }}
            >
              Technical details
            </summary>
            <div className="crash__code">
              <CodeBlock
                value={{
                  message: error.message,
                  name: error.name,
                  stack: (error.stack ?? "").split("\n").slice(0, 12),
                  componentStack: (info?.componentStack ?? "").split("\n").slice(0, 20),
                }}
                language="json"
              />
            </div>
          </details>
        </div>
      </div>
    );
  }
}
