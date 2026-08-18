import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes so a bug in one component shows a recoverable message
 * instead of a blank white page.
 *
 * Still a class component: React has no hook equivalent of `componentDidCatch`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Where a real deployment would report to Sentry or similar.
    console.error("Unhandled render error", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
        <div className="surface w-full max-w-lg p-6">
          <h1 className="text-lg font-semibold text-zinc-900">Something went wrong</h1>
          <p className="mt-1 text-sm text-zinc-600">
            The page hit an unexpected error. Reloading usually clears it.
          </p>

          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
            {error.message}
          </pre>

          <div className="mt-5 flex gap-2">
            <Button
              onClick={() => window.location.reload()}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Reload the page
            </Button>
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
