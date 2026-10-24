import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aplikasi internal ini membaca sesi di setiap halaman. Cache Components
  // menolak pembacaan cookie di luar Suspense, jadi pratinjau lokal memakai
  // render permintaan biasa.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
