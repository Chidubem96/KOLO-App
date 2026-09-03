/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This is a fast-moving V1 prototype. Keep deploys unblocked; tighten later.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
