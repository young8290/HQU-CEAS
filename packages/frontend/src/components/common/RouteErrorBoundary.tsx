import { Component, type ErrorInfo, type ReactNode } from 'react';

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

export default class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route render failed:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-4 dark:bg-neutral-950">
        <div className="w-full max-w-md rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h1 className="text-2xl font-semibold text-neutral-950 dark:text-white">
            页面加载失败
          </h1>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            页面资源已更新，刷新后重试。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex rounded-md bg-[#9a5b3d] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#7c4a34]"
          >
            重新加载页面
          </button>
        </div>
      </div>
    );
  }
}
