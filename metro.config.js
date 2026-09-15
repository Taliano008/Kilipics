const http = require("http");
const https = require("https");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// The KiliPicks public catalog backend does not send CORS headers, so browser
// `fetch()` calls to it fail with "Failed to fetch" when running `expo start --web`.
// This dev-only middleware proxies /kilipicks-proxy/* same-origin requests to the
// real backend server-to-server, where CORS does not apply.
//
// A second proxy /auth-proxy/* routes to the local Fastify auth backend
// (localhost:3000) so the browser never makes a cross-origin request there either.
const CATALOG_PROXY_PREFIX = "/kilipicks-proxy";
const CATALOG_UPSTREAM = "https://nairobi-local-picks-demo.hantianyang5.chatgpt.site";

const AUTH_PROXY_PREFIX = "/auth-proxy";
const AUTH_UPSTREAM = "http://localhost:3000";

function makeProxy(upstreamOrigin, useHttps) {
  const lib = useHttps ? https : http;
  return (req, res, pathWithoutPrefix) => {
    const upstreamUrl = `${upstreamOrigin}${pathWithoutPrefix || "/"}`;
    const options = {
      method: req.method,
      headers: { ...req.headers, host: new URL(upstreamOrigin).host },
    };
    delete options.headers.origin;
    delete options.headers.referer;

    const proxyReq = lib.request(upstreamUrl, options, (upstreamRes) => {
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

const catalogProxy = makeProxy(CATALOG_UPSTREAM, true);
const authProxy = makeProxy(AUTH_UPSTREAM, false);

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith(CATALOG_PROXY_PREFIX)) {
        return catalogProxy(req, res, req.url.slice(CATALOG_PROXY_PREFIX.length) || "/");
      }
      if (req.url && req.url.startsWith(AUTH_PROXY_PREFIX)) {
        return authProxy(req, res, req.url.slice(AUTH_PROXY_PREFIX.length) || "/");
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
