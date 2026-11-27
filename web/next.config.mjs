// Plain JS (not .ts), so the hosting does not need TypeScript to start the app.
/** @type {import("next").NextConfig} */
const nextConfig = {
  // mysql2 is a Node driver: keep it out of the bundle
  serverExternalPackages: ["mysql2"],
  poweredByHeader: false,
  // old Polish addresses: bookmarks and links in earlier agents and installers keep working
  async redirects() {
    const moved = [
      ["/pulpit", "/dashboard"], ["/dni", "/days"], ["/prompty", "/prompts"], ["/konto", "/account"],
      ["/o-serwisie", "/about"], ["/prywatnosc", "/privacy"], ["/raport", "/dashboard"], ["/raport/widok", "/report/view"],
    ];
    return moved.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
  async rewrites() {
    return [
      { source: "/api/agent/plik/:name", destination: "/api/agent/file/:name" },
      { source: "/api/agent/skrypt", destination: "/api/agent/script" },
    ];
  },
};

export default nextConfig;
