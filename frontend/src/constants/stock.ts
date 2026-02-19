// Stock color definitions
export const GREEN_COLOR = "#15803d";
export const RED_COLOR = "#E25C5C";
export const NEUTRAL_COLOR = "#707070";

export const GREEN_GRADIENT: [string, string] = [
  "rgba(21, 128, 61, 0.6)",
  "rgba(21, 128, 61, 0)",
];
export const RED_GRADIENT: [string, string] = [
  "rgba(226, 92, 92, 0.5)",
  "rgba(226, 92, 92, 0)",
];
export const NEUTRAL_GRADIENT: [string, string] = [
  "rgba(112, 112, 112, 0.5)",
  "rgba(112, 112, 112, 0)",
];

export const GREEN_BADGE = { bg: "#f0fdf4", text: "#15803d" };
export const RED_BADGE = { bg: "#FFEAEA", text: "#E25C5C" };
export const NEUTRAL_BADGE = { bg: "#F5F5F5", text: "#707070" };

export type StockColorModeKey = "GREEN_UP_RED_DOWN" | "RED_UP_GREEN_DOWN";

type StockPalette = {
  colors: {
    positive: string;
    negative: string;
    neutral: string;
  };
  gradients: {
    positive: [string, string];
    negative: [string, string];
    neutral: [string, string];
  };
  badges: {
    positive: { bg: string; text: string };
    negative: { bg: string; text: string };
    neutral: { bg: string; text: string };
  };
};

export const STOCK_COLOR_MODE_MAP: Record<StockColorModeKey, StockPalette> = {
  GREEN_UP_RED_DOWN: {
    colors: {
      positive: GREEN_COLOR,
      negative: RED_COLOR,
      neutral: NEUTRAL_COLOR,
    },
    gradients: {
      positive: GREEN_GRADIENT,
      negative: RED_GRADIENT,
      neutral: NEUTRAL_GRADIENT,
    },
    badges: {
      positive: GREEN_BADGE,
      negative: RED_BADGE,
      neutral: NEUTRAL_BADGE,
    },
  },
  RED_UP_GREEN_DOWN: {
    colors: {
      positive: RED_COLOR,
      negative: GREEN_COLOR,
      neutral: NEUTRAL_COLOR,
    },
    gradients: {
      positive: RED_GRADIENT,
      negative: GREEN_GRADIENT,
      neutral: NEUTRAL_GRADIENT,
    },
    badges: {
      positive: RED_BADGE,
      negative: GREEN_BADGE,
      neutral: NEUTRAL_BADGE,
    },
  },
};

export const OFFICIAL_BRAND_GRADIENT = {
  from: "#3A88FF",
  to: "#FF6699",
};

/**
 * Stock configurations for home page display.
 * Used as fallback when /api/v1/system/default-tickers API fails.
 * The API returns region-appropriate stocks based on user's IP location.
 */
export const HOME_STOCK_SHOW = [
  {
    ticker: "NASDAQ:IXIC",
    symbol: "NASDAQ",
  },
  {
    ticker: "HKEX:HSI",
    symbol: "HSI",
  },
  {
    ticker: "SSE:000001",
    symbol: "SSE",
  },
] as const;
