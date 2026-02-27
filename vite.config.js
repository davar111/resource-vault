import { defineConfig } from "vite";

function devRouteParityPlugin() {
  return {
    name: "dev-route-parity",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || "/";
        const [pathname, query = ""] = rawUrl.split("?");
        const querySuffix = query ? `?${query}` : "";

        if (pathname === "/") {
          res.statusCode = 302;
          res.setHeader("Location", `/landing/${querySuffix}`);
          res.end();
          return;
        }

        if (pathname === "/landing" || pathname === "/landing/") {
          req.url = `/landing/index.html${querySuffix}`;
          next();
          return;
        }

        if (pathname === "/app" || pathname.startsWith("/app/")) {
          req.url = `/${querySuffix}`;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [devRouteParityPlugin()],
});
