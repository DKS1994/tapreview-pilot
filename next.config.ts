import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow the dev server's HMR/asset requests from phones on the local network.
  allowedDevOrigins: ["192.168.1.2"],
};

export default nextConfig;
