const { getDefaultConfig } = require("expo/metro-config");
const https = require("https");

const config = getDefaultConfig(__dirname);

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
        https
          .get(
            upstreamUrl,
            { headers: { Accept: "application/json" } },
            (upstreamRes) => {
              res.statusCode = upstreamRes.statusCode || 502;
              const contentType = upstreamRes.headers["content-type"];
              if (contentType) res.setHeader("Content-Type", contentType);
              upstreamRes.pipe(res);
            },
          )
          .on("error", (err) => {
            res.statusCode = 502;
            res.end(
              JSON.stringify({
                error: "Proxy request failed",
                message: err.message,
              }),
            );
          });
        return;
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
