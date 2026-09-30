const http = require("http");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Browser `fetch()` calls from `expo start --web` to the local Fastify backend
// (localhost:3000) would be cross-origin. This dev-only middleware proxies
// /auth-proxy/* same-origin requests to it server-to-server, where CORS does
// not apply. Despite the name it carries everything the backend serves —
// catalog, analytics, auth and uploaded photos (see src/config/env.ts).
const BACKEND_PROXY_PREFIX = "/auth-proxy";
const BACKEND_UPSTREAM = "http://localhost:3000";

function makeProxy(upstreamOrigin) {
  return (req, res, pathWithoutPrefix) => {
    const upstreamUrl = `${upstreamOrigin}${pathWithoutPrefix || "/"}`;
    const options = {
      method: req.method,
      headers: { ...req.headers, host: new URL(upstreamOrigin).host },
    };
    delete options.headers.origin;
    delete options.headers.referer;

    const proxyReq = http.request(upstreamUrl, options, (upstreamRes) => {
      res.statusCode = upstreamRes.statusCode || 502;
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (value) res.setHeader(key, value);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      upstreamRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: "Proxy request failed", message: err.message }));
    });

    req.pipe(proxyReq);
  };
}

const backendProxy = makeProxy(BACKEND_UPSTREAM);

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith(BACKEND_PROXY_PREFIX)) {
        return backendProxy(req, res, req.url.slice(BACKEND_PROXY_PREFIX.length) || "/");
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
