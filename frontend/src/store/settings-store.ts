import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { useShallow } from "zustand/shallow";
import {
  STOCK_COLOR_MODE_MAP,
  type StockColorModeKey,
} from "@/constants/stock";
import i18n from "@/i18n";
import type { StockChangeType } from "@/types/stock";

export type StockColorMode = StockColorModeKey;
export type LanguageCode = "en" | "zh_CN" | "zh_TW" | "ja";
export const DEFAULT_LANGUAGE = "en";

interface SettingsStoreState {
  stockColorMode: StockColorMode;
  language: LanguageCode;
  setStockColorMode: (mode: StockColorMode) => void;
  setLanguage: (language: LanguageCode) => void;
}

const getLanguage = () => {
  if (typeof navigator === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  const map: Record<string, string> = {
    "zh-Hans": "zh_CN",
    "zh-Hant": "zh_TW",
    "ja-JP": "ja",
  };
  return map[navigator.language] ?? DEFAULT_LANGUAGE;
};

const INITIAL_STATE = {
  stockColorMode: "GREEN_UP_RED_DOWN" as StockColorMode,
  language: getLanguage() as LanguageCode,
};

/**
 * Global settings store with localStorage persistence
 */
export const useSettingsStore = create<SettingsStoreState>()(
  devtools(
    persist(
      (set) => ({
        ...INITIAL_STATE,
        setStockColorMode: (stockColorMode) => set({ stockColorMode }),
        setLanguage: (language) => {
          set({ language });
          i18n.changeLanguage(language);
        },
      }),
      {
        name: "valuecell-settings",
      },
    ),
    { name: "SettingsStore", enabled: import.meta.env.DEV },
  ),
);

export const useStockColorMode = () =>
  useSettingsStore(useShallow((s) => s.stockColorMode));

export const useLanguage = () =>
  useSettingsStore(useShallow((s) => s.language));

export const useSettingsActions = () =>
  useSettingsStore(
    useShallow((s) => ({
      setStockColorMode: s.setStockColorMode,
      setLanguage: s.setLanguage,
    })),
  );

const getStockPaletteByMode = (colorMode: StockColorMode) => {
  return STOCK_COLOR_MODE_MAP[colorMode] ?? STOCK_COLOR_MODE_MAP.GREEN_UP_RED_DOWN;
};

export const useStockVisualPalette = () => {
  const colorMode = useStockColorMode();
  return getStockPaletteByMode(colorMode);
};

/**
 * Get stock colors based on current color mode setting
 */
export const useStockColors = (): Record<StockChangeType, string> => {
  const palette = useStockVisualPalette();
  return palette.colors;
};

/**
 * Get stock gradient colors based on current color mode setting
 */
export const useStockGradientColors = (): Record<
  StockChangeType,
  [string, string]
> => {
  const palette = useStockVisualPalette();
  return palette.gradients;
};

/**
 * Get stock badge colors based on current color mode setting
 */
export const useStockBadgeColors = (): Record<
  StockChangeType,
  { bg: string; text: string }
> => {
  const palette = useStockVisualPalette();
  return palette.badges;
};
