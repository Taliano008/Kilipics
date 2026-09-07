// Hits a running server's public catalog endpoint and asserts every
// invariant the mobile app's zod schema (src/schemas/catalog.ts in the
// mobile repo) requires but that a manual code review could miss —
// particularly the ones the Phase Zero spec calls out explicitly in
// "Before you connect the mobile app".
const baseUrl = process.env.CHECK_CATALOG_BASE_URL || "http://localhost:3000";

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

const response = await fetch(`${baseUrl}/api/public/catalog`);
check(response.ok, `expected 200 OK, got ${response.status}`);
check(response.headers.get("cache-control")?.includes("max-age=300"), "missing Cache-Control: max-age=300");

const body = await response.json();

for (const key of ["providers", "services", "availability", "managedMerchantIds", "managedServiceIds", "generatedAt"]) {
  check(key in body, `top-level field "${key}" is missing`);
}
check(Array.isArray(body.providers), "providers is not an array");
check(Array.isArray(body.services), "services is not an array");
check(Array.isArray(body.availability), "availability is not an array");

for (const provider of body.providers ?? []) {
  const label = `provider ${provider.id ?? "(no id)"}`;
  check(provider.location?.city === "Nairobi", `${label}: location.city must be exactly "Nairobi", got ${JSON.stringify(provider.location?.city)}`);
  check(Array.isArray(provider.specialistIds) && provider.specialistIds.length === 0, `${label}: specialistIds must be [], got ${JSON.stringify(provider.specialistIds)}`);
  check(provider.distance === "", `${label}: distance must be "", got ${JSON.stringify(provider.distance)}`);
  check(Array.isArray(provider.highlights), `${label}: highlights must be an array`);
  check(Array.isArray(provider.facilities), `${label}: facilities must be an array`);
  check(Array.isArray(provider.gallery), `${label}: gallery must be an array`);
  check(
    provider.publicContacts !== null && typeof provider.publicContacts === "object" && !Array.isArray(provider.publicContacts),
    `${label}: publicContacts must be an object, got ${JSON.stringify(provider.publicContacts)}`,
  );
  check(typeof provider.openNow === "boolean", `${label}: openNow must be a boolean`);
  check(typeof provider.verified === "boolean", `${label}: verified must be a boolean`);
}

if (failures.length > 0) {
  console.error(`${failures.length} invariant(s) failed:\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`All invariants passed (${body.providers?.length ?? 0} providers, ${body.services?.length ?? 0} services, ${body.availability?.length ?? 0} availability rows).`);
}
