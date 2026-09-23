// Deliberately not smoke.mjs: that script does real signups and mutates the
// database on every run — fine for a one-off check, wrong for a probe that
// runs every 30s for the life of the container. This only checks /healthz.
const url = process.env.HEALTHCHECK_URL || "http://localhost:3000/healthz";

try {
  const response = await fetch(url);
  if (response.status !== 200) {
    console.error(`healthcheck: ${url} returned ${response.status}`);
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`healthcheck: ${url} unreachable`, err);
  process.exitCode = 1;
}
