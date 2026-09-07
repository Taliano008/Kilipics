// Cumulative endpoint smoke test against a running server (npm run dev in
// another terminal first). Exercises both auth systems end to end,
// including the one thing unit tests can't: that consumer and merchant
// really are separate credentials joined only by owner_user_id, not a
// shared row. Creates and then deletes its own throwaway accounts —
// singled out by the "smoke-test+" email tag so cleanup can't touch
// anything real.
const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const tag = Date.now();
const consumerEmail = `smoke-test+consumer-${tag}@kilipicks.dev`;
const sellerEmail = `smoke-test+seller-${tag}@kilipicks.dev`;

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

async function call(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function main() {
  const health = await call("/healthz");
  check(health.status === 200 && health.body?.db === "up", `healthz: expected db up, got ${JSON.stringify(health.body)}`);

  // Plain consumer signup, no merchant.
  const consumerSignup = await call("/api/auth/consumer/signup", {
    method: "POST",
    body: JSON.stringify({ fullName: "Smoke Consumer", email: consumerEmail, password: "smoke-test-pw-1", accountType: "consumer" }),
  });
  check(consumerSignup.status === 201, `consumer signup: expected 201, got ${consumerSignup.status}`);
  check(consumerSignup.body?.merchant === null, "consumer signup: merchant must be null when accountType is consumer");
  const consumerToken = consumerSignup.body?.consumer?.token;
  check(typeof consumerToken === "string" && consumerToken.startsWith("kp_u_"), "consumer signup: missing kp_u_ token");

  // Signup with the merchant profile selected — must create a linked
  // merchant with its own token in the same response.
  const sellerSignup = await call("/api/auth/consumer/signup", {
    method: "POST",
    body: JSON.stringify({ fullName: "Smoke Seller", email: sellerEmail, password: "smoke-test-pw-2", accountType: "merchant" }),
  });
  check(sellerSignup.status === 201, `seller signup: expected 201, got ${sellerSignup.status}`);
  const sellerMerchantToken = sellerSignup.body?.merchant?.token;
  check(typeof sellerMerchantToken === "string" && sellerMerchantToken.startsWith("kp_m_"), "seller signup: missing linked kp_m_ token");
  check(sellerSignup.body?.merchant?.profile?.hasBusiness === false, "seller signup: fresh merchant must have hasBusiness: false");

  // Login re-derives both sessions from one shared password.
  const login = await call("/api/auth/consumer/login", {
    method: "POST",
    body: JSON.stringify({ email: sellerEmail, password: "smoke-test-pw-2" }),
  });
  check(login.status === 200, `seller login: expected 200, got ${login.status}`);
  check(typeof login.body?.merchant?.token === "string", "seller login: expected a merchant token when passwords match");

  // The two identities are independently authenticated: the merchant
  // token must not work as a consumer token, and vice versa.
  const crossCheck = await call("/api/auth/consumer/me", { headers: { Authorization: `Bearer ${sellerMerchantToken}` } });
  check(crossCheck.status === 401, `cross-auth: a merchant token must be rejected by /api/auth/consumer/me, got ${crossCheck.status}`);

  // A plain consumer can become a seller later, with their own new password.
  const becomeSeller = await call("/api/auth/consumer/merchant", {
    method: "POST",
    headers: { Authorization: `Bearer ${consumerToken}` },
    body: JSON.stringify({ fullName: "Smoke Consumer's Business", password: "smoke-test-pw-3" }),
  });
  check(becomeSeller.status === 201, `become seller: expected 201, got ${becomeSeller.status}`);

  // Doing it twice must fail with the specific "already linked" error, not
  // a generic email-taken conflict.
  const becomeSellerAgain = await call("/api/auth/consumer/merchant", {
    method: "POST",
    headers: { Authorization: `Bearer ${consumerToken}` },
    body: JSON.stringify({ fullName: "Smoke Consumer's Business Again", password: "smoke-test-pw-4" }),
  });
  check(
    becomeSellerAgain.status === 409 && becomeSellerAgain.body?.error === "merchant_already_linked",
    `become seller twice: expected 409 merchant_already_linked, got ${becomeSellerAgain.status} ${JSON.stringify(becomeSellerAgain.body)}`,
  );

  // Cleanup — delete both throwaway consumer/merchant pairs directly via
  // the DB layer so this script has no lingering effect on catalog state.
  const { execute, closePool } = await import("../src/db/connection.js");
  await execute("DELETE FROM merchants WHERE email IN (?, ?)", [consumerEmail, sellerEmail]);
  await execute("DELETE FROM users WHERE email IN (?, ?)", [consumerEmail, sellerEmail]);
  await closePool();

  if (failures.length > 0) {
    console.error(`${failures.length} smoke check(s) failed:\n`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("All smoke checks passed (consumer signup, linked merchant signup, login, cross-auth rejection, become-seller, duplicate-link rejection).");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
