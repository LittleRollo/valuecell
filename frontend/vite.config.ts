import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import createSvgSpritePlugin from "vite-plugin-svg-sprite";
import tsconfigPaths from "vite-tsconfig-paths";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    createSvgSpritePlugin({
      exportType: "vanilla",
      include: "**/assets/svg/**/*.svg",
      svgo: {
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                // Keep viewBox attribute, important for icon scaling
                removeViewBox: false,
                // Keep accessibility attributes
                removeUnknownsAndDefaults: {
                  keepDataAttrs: false,
                  keepAriaAttrs: true,
                },
                // Clean up IDs while maintaining uniqueness
                cleanupIds: {
                  minify: true,
                  preserve: [],
                },
                // Preserve currentColor and don't remove useful attributes
                removeUselessStrokeAndFill: false,
              },
            },
          },
          // Only remove data attributes and classes, preserve fill/stroke for currentColor
          {
            name: "removeAttrs",
            params: {
              attrs: "(data-.*|class)",
              elemSeparator: ",",
            },
          },
          // Remove unnecessary metadata and comments
          "removeMetadata",
          "removeComments",
          // Remove empty elements
          "removeEmptyText",
          "removeEmptyContainers",
          // Optimize paths and merge when possible
          "convertPathData",
          "mergePaths",
          // Convert colors but preserve currentColor
          {
            name: "convertColors",
            params: {
              currentColor: true,
            },
          },
        ],
      },
    }),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  resolve:
    process.env.NODE_ENV === "development"
      ? {}
      : {
          alias: {
            "react-dom/server": "react-dom/server.node",
          },
        },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/")
          ) {
            return "vendor-react";
          }

          if (
            id.includes("node_modules/react-router/") ||
            id.includes("node_modules/@react-router/")
          ) {
            return "vendor-router";
          }

          if (id.includes("node_modules/echarts/")) {
            return "vendor-echarts";
          }

          if (
            id.includes("node_modules/@radix-ui/") ||
            id.includes("node_modules/lucide-react/")
          ) {
            return "vendor-ui";
          }

          if (
            id.includes("node_modules/i18next/") ||
            id.includes("node_modules/react-i18next/")
          ) {
            return "vendor-i18n";
          }

          if (
            id.includes("node_modules/react-markdown/") ||
            id.includes("node_modules/remark-gfm/") ||
            id.includes("node_modules/rehype-raw/")
          ) {
            return "vendor-markdown";
          }

          return "vendor-misc";
        },
      },
    },
  },
}));
