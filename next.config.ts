import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phones/tablets on the local network to load dev assets,
  // otherwise the page renders but never hydrates (dead buttons).
  allowedDevOrigins: ["192.168.1.*"],
};

export default nextConfig;
