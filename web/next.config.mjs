// Plain JS (not .ts), so the hosting does not need TypeScript to start the app.
/** @type {import("next").NextConfig} */
const nextConfig = {
  // mysql2 is a Node driver: keep it out of the bundle
  serverExternalPackages: ["mysql2"],
  poweredByHeader: false,
};

export default nextConfig;
