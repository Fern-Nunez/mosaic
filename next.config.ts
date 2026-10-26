import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phones/tablets on the local network to load dev assets,
  // otherwise the page renders but never hydrates (dead buttons).
  allowedDevOrigins: ["192.168.1.*"],
  // Keep the dev "N" badge out of the way of the bottom tab bar.
  devIndicators: { position: "top-right" },
};

export default nextConfig;
