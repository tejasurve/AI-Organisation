/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Node-native scripts under `scripts/` use `.ts` import specifiers and run
  // outside of Next.js. We keep them isolated from the bundler.
  typescript: {
    tsconfigPath: "tsconfig.web.json",
  },
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
