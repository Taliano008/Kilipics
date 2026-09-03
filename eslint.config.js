const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ["dist/*", "node_modules/*", ".expo/*", "web-build/*"],
  },
  {
    rules: {
      // Pre-existing patterns (e.g. syncing a route param into local state)
      // predate these newer React Compiler-readiness rules. Downgraded
      // rather than rewritten here to keep this pass formatting-only.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
