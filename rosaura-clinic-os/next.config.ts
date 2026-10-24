import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
