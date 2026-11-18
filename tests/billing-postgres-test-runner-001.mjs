// node tests/billing-postgres-test-runner-001.mjs --authorized-billing-lab
// One ordered run in the authorized existing laboratory. Fixtures remain in
// place afterward; another run on a nonempty database must stop, never reset it.
import { openBillingPostgresLab } from "./helpers/billing-postgres-lab.mjs";
import { runBillingCorePostgresTests } from "./billing-simplified-core-001-postgres.mjs";
import { runBillingDraftPostgresTests } from "./billing-simplified-draft-001-postgres.mjs";

try {
  const lab = openBillingPostgresLab();
  await runBillingCorePostgresTests(lab); // Includes issue idempotency before core migration.
  await runBillingDraftPostgresTests(lab);
  console.log("POSTGRES_TESTS_PASS (synthetic source/auth fixtures, real Billing DDL/RPCs)");
} catch (error) {
  console.error("POSTGRES_TESTS_FAIL — stopped; laboratory retained without cleanup");
  console.error(error);
  process.exitCode = 1;
}
