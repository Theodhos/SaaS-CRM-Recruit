/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' copies traced dependencies with symlinks, which Windows only
  // allows for admins / Developer Mode (`next build` fails with EPERM). Docker
  // and CI build on Linux and keep it; set NEXT_OUTPUT_STANDALONE=1 to force it.
  ...(process.platform !== 'win32' || process.env.NEXT_OUTPUT_STANDALONE === '1'
    ? { output: 'standalone' }
    : {}),
  // Allow importing TS source directly from workspace packages without a
  // separate build step for each (Turborepo handles the actual build graph).
  transpilePackages: ['@crm/ui', '@crm/types', '@crm/utils', '@crm/validation'],
  // pdfjs-dist (the CV editor) mentions the Node-only 'canvas' package; the browser build never loads it
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  experimental: {
    // Per-icon/per-component imports instead of pulling the whole package
    // into every route that uses one icon or one chart — lucide-react and
    // recharts are both large enough for this to matter.
    optimizePackageImports: ['@crm/ui', 'lucide-react', 'recharts'],
  },
};

export default nextConfig;
