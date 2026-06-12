/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Type and lint checks run in CI (GitHub Actions), so they do not
  // block production deploys. Flip these to false to make Vercel
  // builds strict again.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
