import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App crashed", error, errorInfo);
  }

  private reset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto min-h-screen w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-5">
          <section className="glass-panel animate-fadeInUp space-y-3 p-5">
            <h1 className="text-lg font-bold text-white">Something went wrong</h1>
            <p className="text-sm text-slate-300">
              The app hit an unexpected error. Tap reload to safely recover.
            </p>
            <button
              type="button"
              className="rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white hover:bg-white/10"
              onClick={this.reset}
            >
              Reload
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
