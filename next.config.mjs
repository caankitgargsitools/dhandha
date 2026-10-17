/** @type {import('next').NextConfig} */
const nextConfig = {
  // the monthly MCA register upload (Admin → New companies) can be a few MB; Vercel caps request bodies at 4.5 MB
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
