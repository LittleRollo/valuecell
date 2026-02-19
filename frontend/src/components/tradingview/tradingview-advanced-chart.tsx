import { memo, useEffect, useMemo, useRef } from "react";
import defaultMap from "./tv-symbol-map.json";
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

interface TradingViewAdvancedChartProps {
  ticker: string;
  mappingUrl?: string;
  interval?: string;
  minHeight?: number;
  theme?: "light" | "dark";
  locale?: string;
  timezone?: string;
  upColor?: string;
  downColor?: string;
}

function TradingViewAdvancedChart({
  ticker,
  mappingUrl,
  interval = "D",
  minHeight = 420,
  theme = "light",
  locale = "en",
  timezone = "UTC",
  upColor = "#15803d",
  downColor = "#E25C5C",
}: TradingViewAdvancedChartProps) {
  const symbolMapRef = useRef<Record<string, string>>(
    defaultMap as Record<string, string>,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mappingUrl) return;
    let cancelled = false;
    fetch(mappingUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        if (!cancelled)
          symbolMapRef.current = (json || {}) as Record<string, string>;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mappingUrl]);

  const tvSymbol = useMemo(() => {
    const t = ticker;
    if (typeof t === "string" && t.includes(":")) {
      const [ex, sym] = t.split(":");
      const exUpper = ex.toUpperCase();
      if (exUpper === "HKEX") {
        const norm = (sym ?? "").replace(/^0+/, "") || "0";
        return `${exUpper}:${norm}`;
      }
    }
    const m = symbolMapRef.current;
    if (m && typeof m === "object" && t in m) {
      const v = m[t];
      if (typeof v === "string" && v.length > 0) return v;
    }
    return t;
  }, [ticker]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!tvSymbol) return;

    if (!widget) return;

    clearNodeSafely(widget);
    scriptRef.current = null;

    const host = document.createElement("div");
    host.className = "tradingview-widget-host h-full";
    widget.appendChild(host);
    hostRef.current = host;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.innerHTML = JSON.stringify({
      allow_symbol_change: true,
      calendar: false,
      details: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      hotlist: false,
      interval,
      locale,
      save_image: true,
      style: "1",
      symbol: tvSymbol,
      theme,
      timezone,
      backgroundColor: theme === "light" ? "#ffffff" : "#131722",
      gridColor: "rgba(46, 46, 46, 0.06)",
      watchlist: [],
      withdateranges: false,
      compareSymbols: [],
      studies: [],
      overrides: {
        "mainSeriesProperties.candleStyle.upColor": upColor,
        "mainSeriesProperties.candleStyle.downColor": downColor,
        "mainSeriesProperties.candleStyle.borderUpColor": upColor,
        "mainSeriesProperties.candleStyle.borderDownColor": downColor,
        "mainSeriesProperties.candleStyle.wickUpColor": upColor,
        "mainSeriesProperties.candleStyle.wickDownColor": downColor,
      },
      autosize: true,
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
  }, [tvSymbol, interval, theme, locale, timezone, upColor, downColor]);

  return (
    <section
      aria-label="Trading chart"
      className="w-full"
      style={{ height: minHeight }}
    >
      <div ref={containerRef} className="tradingview-widget-container h-full">
        <div
          ref={widgetRef}
          className="tradingview-widget-container__widget h-full"
        />
      </div>
    </section>
  );
}

function TradingViewAdvancedChartWithBoundary(
  props: TradingViewAdvancedChartProps,
) {
  const resetKey = [
    props.ticker,
    props.interval ?? "D",
    props.theme ?? "light",
    props.locale ?? "en",
    props.timezone ?? "UTC",
  ].join("|");

  return (
    <TradingViewErrorBoundary
      resetKey={resetKey}
      fallback={<section className="w-full" style={{ height: props.minHeight ?? 420 }} />}
    >
      <TradingViewAdvancedChart {...props} />
    </TradingViewErrorBoundary>
  );
}

export default memo(TradingViewAdvancedChartWithBoundary);
