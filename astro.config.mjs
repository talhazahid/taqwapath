import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://taqwapath.com",
  trailingSlash: "never",
  redirects: {
    "/hadees": {
      status: 301,
      destination: "/hadith"
    },
    "/listen-quran": {
      status: 301,
      destination: "/quran-online"
    }
  },
  vite: {
    optimizeDeps: {
      noDiscovery: true,
      include: []
    }
  }
});
