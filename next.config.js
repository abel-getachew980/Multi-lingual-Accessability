const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Shown when a navigation fails and nothing matching is in the cache.
  fallbacks: {
    document: '/offline.html',
  },
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
        }
      }
    },
    // The course catalogue is read-only and changes rarely: keep it available
    // so the learner can still browse material on a 3G connection.
    {
      urlPattern: /\/api\/ai\/course$/,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'course-catalog',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 7 * 24 * 60 * 60
        }
      }
    }
  ]
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: []
  },
  experimental: {
    // App Router configuration
    optimizeCss: true
  }
};

module.exports = withPWA(nextConfig);
