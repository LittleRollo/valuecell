import { memo, useEffect, useMemo, useRef } from "react";
import TradingViewErrorBoundary from "./tradingview-error-boundary";

function clearNodeSafely(node: HTMLElement | null): void {
  if (!node) return;

  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.parentNode === node) {
      node.removeChild(child);
    }
  }
}

interface TradingViewTickerTapeProps {
  symbols: string[];
  theme?: "light" | "dark";
  locale?: string;
}

function TradingViewTickerTape({
  symbols,
  theme = "light",
  locale = "en",
}: TradingViewTickerTapeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const tapeSymbols = useMemo(
    () => symbols.slice(0, 8).map((s) => ({ proName: s })),
    [symbols],
  );

  useEffect(() => {
    const widget = widgetRef.current;

    if (!widget) return;

    clearNodeSafely(widget);
    scriptRef.current = null;

    const host = document.createElement("div");
    host.className = "tradingview-widget-host";
    widget.appendChild(host);
    hostRef.current = host;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.innerHTML = JSON.stringify({
      symbols: tapeSymbols,
      showSymbolLogo: true,
      colorTheme: theme,
      isTransparent: false,
      displayMode: "regular",
      locale,
    });

    host.appendChild(script);
    scriptRef.current = script;

    return () => {
      const currentHost = hostRef.current;
      const currentScript = scriptRef.current;

      if (currentHost && currentScript && currentScript.parentNode === currentHost) {
        currentHost.removeChild(currentScript);
      }
      if (currentHost && currentHost.parentNode === widget) {
        widget.removeChild(currentHost);
      }

      clearNodeSafely(widget);
      hostRef.current = null;
      scriptRef.current = null;
    };
  }, [tapeSymbols, theme, locale]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="tradingview-widget-container">
        <div ref={widgetRef} className="tradingview-widget-container__widget" />
      </div>
    </div>
  );
}

function TradingViewTickerTapeWithBoundary(props: TradingViewTickerTapeProps) {
  const resetKey = [props.theme ?? "light", props.locale ?? "en", ...props.symbols]
    .join("|");

  return (
    <TradingViewErrorBoundary resetKey={resetKey} fallback={<div className="w-full" />}>
      <TradingViewTickerTape {...props} />
    </TradingViewErrorBoundary>
  );
}

export default memo(TradingViewTickerTapeWithBoundary);
