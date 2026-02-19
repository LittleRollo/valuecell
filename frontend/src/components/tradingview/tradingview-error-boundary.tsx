import { Component, type ReactNode } from "react";

interface TradingViewErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
  fallback?: ReactNode;
}

interface TradingViewErrorBoundaryState {
  hasError: boolean;
}

export default class TradingViewErrorBoundary extends Component<
  TradingViewErrorBoundaryProps,
  TradingViewErrorBoundaryState
> {
  state: TradingViewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): TradingViewErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: TradingViewErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}
