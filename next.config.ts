import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "http://192.168.0.154:3000", // exact host:port
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "http://*.0.154:3000", // wildcard (not standard, see note below)
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
  experimental: {
    // Add valid experimental options here if needed
  },
};

export default nextConfig;
