import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The app is one orbit at "/"; old per-screen routes deep-link into it.
  redirects() {
    return [
      { source: "/portfolio", destination: "/?view=portfolio", permanent: false },
      { source: "/replay", destination: "/?view=replay", permanent: false },
    ];
  },
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
