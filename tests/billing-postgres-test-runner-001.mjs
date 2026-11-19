// node tests/billing-postgres-test-runner-001.mjs --authorized-billing-lab
// Issue validation: append --simplified-issue (fixed phoenix_billing_issue_test_001).
// One ordered run in the authorized existing laboratory. Fixtures remain in
// place afterward; another run on a nonempty database must stop, never reset it.
import { openBillingPostgresLab } from "./helpers/billing-postgres-lab.mjs";
import { runBillingCorePostgresTests } from "./billing-simplified-core-001-postgres.mjs";
import { runBillingDraftPostgresTests } from "./billing-simplified-draft-001-postgres.mjs";
import { runBillingSimplifiedIssuePostgresTests } from "./billing-simplified-issue-001-postgres.mjs";

const simplifiedIssue = process.argv.includes("--simplified-issue");
try {
  const lab = openBillingPostgresLab({ simplifiedIssue });
  await runBillingCorePostgresTests(lab); // Includes issue idempotency before core migration.
  await runBillingDraftPostgresTests(lab);
  if (simplifiedIssue) await runBillingSimplifiedIssuePostgresTests(lab);
  console.log(`${simplifiedIssue ? "POSTGRES_ISSUE_PASS" : "POSTGRES_TESTS_PASS"} (synthetic source/auth fixtures, real Billing DDL/RPCs)`);
} catch (error) {
  console.error(`${simplifiedIssue ? "POSTGRES_ISSUE_FAIL" : "POSTGRES_TESTS_FAIL"} — stopped; laboratory retained without cleanup`);
  console.error(error);
  process.exitCode = 1;
}
