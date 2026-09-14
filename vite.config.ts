import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const bindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat", "nodejs_compat_populate_process_env"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "iks-book-studio-db",
          database_id: "03cfa500-1efd-4e89-8f08-4b438599d123",
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    optimizeDeps: { exclude: ["@clerk/nextjs"] },
    // Workerd has node compatibility but no filesystem for Clerk's keyless setup.
    // Select the SDK's own edge-safe runtime rather than its Node require() shim.
    resolve: { alias: { '#safe-node-apis': new URL('./node_modules/@clerk/nextjs/dist/esm/runtime/browser/safe-node-apis.js', import.meta.url).pathname } },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      {
        name: 'clerk-vinext-navigation',
        enforce: 'pre' as const,
        transform(code, id) {
          // Clerk ships this optional Next import as require() inside ESM.
          // Vite/workerd need a static import; preserve the SDK's hook logic.
          if (!id.split('?')[0].endsWith('/@clerk/nextjs/dist/esm/client-boundary/hooks/usePathnameWithoutCatchAll.js')) return;
          return code.replaceAll('require("next/navigation")', '__clerkNavigation') + '\nimport * as __clerkNavigation from "next/navigation";\n';
        },
      },
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        // Draft bindings let Wrangler create the correct local resources and
        // automatically provision production D1/R2 resources on deployment.
        config: bindingConfig,
      }),
    ],
  };
});
