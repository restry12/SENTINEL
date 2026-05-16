/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["mapbox-gl"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
