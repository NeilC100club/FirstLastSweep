/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Loaded straight from node_modules on the server (used to build the board PDF
    // that's emailed at kick-off) rather than bundled.
    serverComponentsExternalPackages: ["jspdf"],
  },
};

export default nextConfig;
