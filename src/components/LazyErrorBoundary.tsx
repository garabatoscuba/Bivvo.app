import { Component, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retried: boolean;
}

export class LazyErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retried: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch() {
    // On first error, retry once (clears stale module cache)
    if (!this.state.retried) {
      this.setState({ hasError: false, retried: true });
      return;
    }
    // After retry still fails → redirect to safe route
    const isAuthenticated = !!localStorage.getItem("sb-znmzhfdsgdxwwmlvkwpd-auth-token");
    window.location.href = isAuthenticated ? "/" : "/auth";
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return this.props.children;
  }
}
