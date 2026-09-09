const https = require("https");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// The KiliPicks public catalog backend does not send CORS headers, so browser
// `fetch()` calls to it fail with "Failed to fetch" when running `expo start --web`.
// This dev-only middleware proxies /kilipicks-proxy/* same-origin requests to the
// real backend server-to-server, where CORS does not apply.
const PROXY_PREFIX = "/kilipicks-proxy";
const UPSTREAM_ORIGIN =
  "https://nairobi-local-picks-demo.hantianyang5.chatgpt.site";

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith(PROXY_PREFIX)) {
        const upstreamUrl = `${UPSTREAM_ORIGIN}${req.url.slice(PROXY_PREFIX.length) || "/"}`;
        const options = {
          method: req.method,
          headers: { ...req.headers, host: new URL(UPSTREAM_ORIGIN).host },
        };
        // Remove headers that might confuse the upstream or cause issues
        delete options.headers.origin;
        delete options.headers.referer;
        
        const proxyReq = https.request(upstreamUrl, options, (upstreamRes) => {
          res.statusCode = upstreamRes.statusCode || 502;
          for (const [key, value] of Object.entries(upstreamRes.headers)) {
            if (value) res.setHeader(key, value);
          }
          // Enable CORS for web dev server
          res.setHeader('Access-Control-Allow-Origin', '*');
          upstreamRes.pipe(res);
        });

        proxyReq.on("error", (err) => {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error: "Proxy request failed",
              message: err.message,
            }),
          );
        });

        req.pipe(proxyReq);
        return;
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
