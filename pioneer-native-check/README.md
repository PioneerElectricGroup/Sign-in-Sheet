# Pioneer v19 — native rule-engine diagnosis

**Diagnostic only. Not a rules patch and not a live release.**

Your latest report (September 24, 2026, started at 14:02:24.590 UTC) confirms that both synthetic arrivals saved and both properly signed departures were rejected. The intentional blank-signature rejection is a different test. This package obtains Google's emulator evaluation details without changing the published rules or asking the iPad to repeat the failed sequence.

## Upload two NEW folders, not a replacement web page

1. Extract this ZIP on the computer. Open `UPLOAD_TO_GITHUB`.
2. In GitHub, open the **main/root** of **PioneerElectricGroup / Sign-in-Sheet** — NOT its `live` folder. Choose **Add file → Upload files**.
3. Drag BOTH folders from `UPLOAD_TO_GITHUB` into GitHub: **`.github`** and **`pioneer-native-check`**. The leading dot in `.github` is intentional. Verify these destinations before committing:

   ```
   .github/workflows/pioneer-native-rule-check.yml
   pioneer-native-check/package.json
   pioneer-native-check/firebase.json
   pioneer-native-check/emulator-only.rules
   pioneer-native-check/fixtures.json
   pioneer-native-check/run.mjs
   pioneer-native-check/support.mjs
   pioneer-native-check/selftest.mjs
   pioneer-native-check/collect.mjs
   pioneer-native-check/README.md
   pioneer-native-check/.gitignore
   ```

   Upload the folder CONTENTS at these exact paths; do not add an extra `UPLOAD_TO_GITHUB` prefix. Do not upload this entire ZIP or any real attendance/diagnostic export. Commit directly to the existing default branch (`main`). This adds development files only; no `index.html`, service worker, or published Firebase rules are replaced.

## Run on GitHub, not the iPad

1. Open the repository's **Actions** tab.
2. Select **Pioneer native rule diagnosis** on the left.
3. Click **Run workflow**, leave branch **main**, and confirm **Run workflow**.
4. Open that run when it finishes, then click the **diagnose** job. Use the menu at the upper right of its log output and choose **Download log archive**. Attach that downloaded ZIP to the chat, whether the run is green or red. A red result can contain the engine error we need; do not rerun it first.

This workflow is manual-only. It uses a standard Ubuntu runner and is configured to SKIP private repositories rather than consume their metered minutes. It uploads no Actions artifact or cache: the evidence is in ordinary downloadable workflow logs. If GitHub skips it or blocks Actions, send that screen; **do not change repository visibility, enable billing, supply a Firebase token, or add secrets**.

## What stays unchanged

Leave the iPad on Diagnostic 2, with Jake's existing prepared login. Keep Evaluation Patch 2 published and real attendance disabled. Do not edit/close/delete the CHECK records yet; their current open state is preserved in the real validation area. This diagnostic does not contact that area at all.

## Privacy and isolation

This package does NOT contain the uploaded report. It contains only a recreated test fixture for the fictional CHECK Hourly / CHECK Salary workers, with replacement account, device and operation identifiers. Signature coordinates are the original automated synthetic zigzag, not any person's handwritten signature. It contains no app API key, password, authentication token, real roster, or production project configuration.

The runner uses Google's `@firebase/rules-unit-testing` library, a fixed demo project `demo-pioneer-v19`, and the local address `127.0.0.1:8080`. The runner refuses a missing/non-local emulator host, a different project ID, or supplied Google/Firebase credentials. The workflow has read-only repository permissions, no Firebase deployment command, and no activation code.

`emulator-only.rules` uses fictional UIDs and must NEVER be pasted into the Firebase console. Its Patch 2 validation logic is unchanged. Later forensic cases temporarily bypass supporting validators ONLY inside the disposable emulator to identify which original validator fails; those are not candidate production permissions and are not launch-acceptance passes.

## Test evidence and limitations

The package's JavaScript syntax, fixture transformations, path/credential guards, and rule-isolation rewrites were checked locally. The accompanying self-test reports **66 passed package checks**. They do not evaluate Google's rules.

Google's emulator could not be run in this chat environment: dependency downloads failed. Native rule compilation, fixture execution, workflow execution and Google error traces are therefore still pending. The GitHub job is designed to obtain that evidence. It records dependency versions and the test-rule checksum in the log archive.

The native matrix contains 16 full-rule cases (five recorded transaction shapes and eleven access restrictions), eight collection-validator isolation cases, and nine helper isolation cases. The isolation rows are forensic diagnostics, not extra security passes. Capture timestamps are shifted to a recent minute for local execution; original order, shape, signatures and code semantics are preserved. Server timestamp placeholders become actual SDK transforms. The shared `audit.after` is reconstructed from the exact matching top-level punch, as the application does; diagnostic `[DEPTH LIMIT]` markers are never treated as saved values.

**A successful/green workflow means the diagnostic collected its results. It does not mean the app is ready to activate.**

## References

- Firebase emulator unit-test setup: https://firebase.google.com/docs/rules/unit-tests
- Firestore evaluation tracing: https://firebase.google.com/docs/firestore/security/test-rules-emulator
- Manual GitHub workflows: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
- Workflow logs: https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
