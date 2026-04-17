import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";

/**
 * noVNC's lib/util/browser.js (Babel CJS build) contains a top-level `await`
 * for a WebCodecs H264 capability check. Rollup's CJS plugin can't handle
 * top-level await, so we transform that single line before it is processed:
 * replace the synchronous `= await fn()` assignment with a fire-and-forget
 * `.then()` — the value defaults to `null`, which is safe for a codec check.
 */
function novncBrowserFix(): Plugin {
  return {
    name: "novnc-browser-fix",
    transform(code, id) {
      if (!id.includes("@novnc") || !id.includes("browser.js")) return;
      const transformed = code.replace(
        /exports\.supportsWebCodecsH264Decode\s*=\s*supportsWebCodecsH264Decode\s*=\s*await\s+_checkWebCodecsH264DecodeSupport\(\);/,
        [
          "exports.supportsWebCodecsH264Decode = supportsWebCodecsH264Decode = null;",
          "_checkWebCodecsH264DecodeSupport().then(function(v) {",
          "  exports.supportsWebCodecsH264Decode = supportsWebCodecsH264Decode = v;",
          "});",
        ].join(" "),
      );
      // Return null map to suppress the "missing sourcemap" warning
      return { code: transformed, map: null };
    },
  };
}

export default defineConfig({
  plugins: [novncBrowserFix()],
  root: "src/client",
  publicDir: resolve(__dirname, "public"),
  resolve: {
    alias: {
      "@client": resolve(__dirname, "src/client"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist/client"),
    emptyOutDir: true,
    sourcemap: true,
    target: "esnext",
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/client/index.html"),
        vnc: resolve(__dirname, "src/client/vnc.html"),
      },
      output: {
        manualChunks: {
          novnc: ["@novnc/novnc/lib/rfb.js"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/websockify": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["@novnc/novnc/lib/rfb.js"],
  },
});
