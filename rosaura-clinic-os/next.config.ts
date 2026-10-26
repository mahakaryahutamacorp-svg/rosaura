import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Aplikasi internal ini membaca sesi di setiap halaman. Cache Components
  // menolak pembacaan cookie di luar Suspense, jadi pratinjau lokal memakai
  // render permintaan biasa.
  cacheComponents: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "24mb",
      allowedOrigins: ["rosaura.pro", "www.rosaura.pro"],
    },
    proxyClientMaxBodySize: "24mb",
  },
};

export default nextConfig;
