/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'jszip'],
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
}

module.exports = nextConfig
