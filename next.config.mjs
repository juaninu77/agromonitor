import withPWAInit from "next-pwa"
import defaultRuntimeCaching from "next-pwa/cache.js"

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // Workbox does not honor Cache-Control as an authorization boundary.
      // Never serve authenticated API/admin responses from another login's cache.
      urlPattern: ({ url }) => url.pathname.startsWith("/api/") || url.pathname === "/administracion" || url.pathname === "/finanzas",
      handler: "NetworkOnly",
      method: "GET",
    },
    ...defaultRuntimeCaching,
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // Optimizaciones de performance
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Optimización de paquetes - reduce bundle size
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'recharts',
      'date-fns',
    ],
  },
}

export default withPWA(nextConfig)
