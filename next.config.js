const { env } = require('./env/server')

// throws if validation fails
require('./utils/validation')

const { NEXT_PUBLIC_ASSET_PREFIX, BUILD_DIR, DATA_DIR, PUBLIC_DIR } = env;
const isProd = process.env.NODE_ENV !== "development";

// NOTE: __dirname is the dirname where this configuration file is located
const payload = {
  reactStrictMode: true,
  devIndicators: false, // disable: accesses window.next.router.components before router init → TypeError
  trailingSlash: true,
  output: isProd ? 'export' : undefined,
  images: { unoptimized: true },
  // Stub Node.js built-ins that @dendronhq/common-frontend pulls in via
  // @aws-amplify/core → @aws-sdk. These are server-only; the browser bundle
  // never actually calls them, but Turbopack requires explicit aliases.
  turbopack: {
    root: __dirname,
    resolveAlias: {
      'child_process': { browser: './utils/empty-node-module' },
      'fs': { browser: './utils/empty-node-module' },
      'http2': { browser: './utils/empty-node-module' },
    },
  },
  basePath:
    isProd && NEXT_PUBLIC_ASSET_PREFIX ? NEXT_PUBLIC_ASSET_PREFIX : undefined,
  assetPrefix:
    isProd && NEXT_PUBLIC_ASSET_PREFIX ? NEXT_PUBLIC_ASSET_PREFIX : undefined,
  env: {
    DATA_DIR,
    PUBLIC_DIR,
  },
  distDir: BUILD_DIR || '.next',
};

if (!isProd && process.env.ANALYZE) {
  // eslint-disable-next-line global-require
  const withBundleAnalyzer = require("@next/bundle-analyzer")({
    enabled: process.env.ANALYZE === "true",
  });
  module.exports = withBundleAnalyzer(payload);
} else {
  module.exports = payload;
}
