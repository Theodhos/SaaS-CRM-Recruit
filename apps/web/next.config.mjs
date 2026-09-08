/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Allow importing TS source directly from workspace packages without a
  // separate build step for each (Turborepo handles the actual build graph).
  transpilePackages: ['@crm/ui', '@crm/types', '@crm/utils', '@crm/validation'],
  experimental: {
    optimizePackageImports: ['@crm/ui'],
  },
};

export default nextConfig;
