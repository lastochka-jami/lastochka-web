import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  basePath: '/shop',
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  serverExternalPackages: ['node:sqlite'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lastochki.store',
      },
      {
        protocol: 'https',
        hostname: '**.lastochki.store',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), geolocation=(self), microphone=()',
          },
        ],
      },
    ];
  },
};

export default config;
