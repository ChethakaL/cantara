/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
    serverActionsBodySizeLimit: '100mb',
  },
}

module.exports = nextConfig
