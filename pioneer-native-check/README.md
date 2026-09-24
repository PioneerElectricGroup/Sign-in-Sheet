# Pioneer v19 — Patch 4 native candidate

**Emulator only. Not production rules. No attendance activation.**

This replaces the existing `pioneer-native-check` test folder. Keep the already-installed `.github/workflows/pioneer-native-rule-check.yml` unchanged. Keep the published Evaluation Patch 2 rules, Diagnostic 2 webpage, service worker and tablet preparation unchanged.

## Run the new candidate

1. Upload all files from this folder into the repository's existing `pioneer-native-check` folder. Add the new files and replace the existing ones. Do not create a nested `pioneer-native-check/pioneer-native-check` folder.
2. Commit to `main` with message `Patch 4 native candidate`.
3. Open **Actions → Pioneer native rule diagnosis → Run workflow → main**. Start a new run; do not rerun the old commit.

The summary must identify **PATCH 4 CANDIDATE**. Required native result: **101/101 full-rule expectations**, **0 native budget failures**, **0 incomplete evidence**, and **Native acceptance gate: PASS**. The 17 isolated helper/collection diagnostics are not additional security passes. Send the new run summary for review. Only if that new run fails, download its log archive from **diagnose → gear beside Search logs → Download log archive**.

Do not paste `emulator-only.rules` into Firebase. Its accounts are deliberately fictional. Passing this native suite is not permission to activate real attendance; production-ID reconciliation and validation-page/device checks still follow.

## What changed

Only two v19 rule helper bodies changed: `auditMatches` and `receiptRequired`. They require a newly created audit/receipt in the same atomic save and bind it to the punch ID. The original full audit and receipt creation validators still enforce their complete field and snapshot relationships. The repeated field comparisons no longer run a second time inside the punch validator. All other rule predicates, including the entire v18 area, remain unchanged. Candidate comments also identify Patch 4.

The suite retains all original 40 expected outcomes, adds 61 regressions, rejects budget-error denials as passing security tests, and limits duplicate log/coverage output. SDK/CLI versions, workflow, UI, one-code-per-day behavior, signatures, account roles and free/manual-CSV approach are not changed.

## Verification status at delivery

JavaScript syntax, source integrity, fixture consistency and test-harness checks passed locally. **Google's native emulator has NOT executed this candidate here.** Dependency installation failed because this environment could not resolve/reach `registry.npmjs.org` (`EAI_AGAIN`). Native verification must come from the new GitHub workflow run, not from these local source checks.
