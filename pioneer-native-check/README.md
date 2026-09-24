# Pioneer v19 — verify the Patch 3 correction in the existing native workflow

The downloaded logs identify the 1,000-expression evaluation limit as the native failure on both signed departures. This package tests a targeted expression-budget correction. It is NOT a Firebase deployment package.

## Upload once to the existing diagnostic folder

1. Extract this ZIP on your computer.
2. In GitHub, click Code, then open the existing **pioneer-native-check** folder.
3. Choose Add file > Upload files. In the extracted ZIP, open **UPLOAD_TO_GITHUB/pioneer-native-check** and select **all eight files inside it**. Upload the files, not another containing folder.
4. The destination must be **pioneer-native-check/<filename>**, never live/, the repository root, or pioneer-native-check/pioneer-native-check/.
5. Commit directly to main. The existing .github workflow and pinned package dependencies do not change.

## Run the NEW commit

Go to Actions > Pioneer native rule diagnosis > Run workflow. Choose main and click Run workflow.
Do not click Re-run all jobs on the previous run: that would retest the old commit.

The summary must identify PATCH 3 CANDIDATE. The target is **40 / 40 full-rule cases matching intended behavior**, including allowed hourly and salaried departures and rejected forbidden operations.
The 17 isolated helper/collection rows remain forensic diagnostics; do not count them as additional security passes.

This updated runner returns a failed status if any of the full-rule cases has an unexpected outcome. A passing isolated native test is still not live activation or a complete security audit.

Send the summary screenshot. If any full-rule case fails or the job errors, download the completed job log archive (gear beside Search logs) and attach the ZIP.

## Leave these alone

Do NOT paste emulator-only.rules into Firebase: it deliberately contains fictional account IDs.
Keep the currently published Patch 2 rules, the Diagnostic 2 web page, the service worker, and the iPad setup unchanged. Do not edit/delete CHECK worker records or clear Safari data. Real attendance remains disabled.

## Technical changes

- Candidate rules use one arrival/departure dispatch instead of evaluating the larger combined operation expression tree.
- Two-digit and millisecond padding use fixed string slices. Positive calendar/time component values retain identical output.
- No rules granting public access, approvals, old-block edits, or deletions are added.
- The source fixtures remain fictional. Their SHA metadata now identifies the Patch 3 candidate.
- Native regression coverage adds repeated periods, up to 40 blocks, approval invalidation, Undo and deliberately invalid departures.
- Log collection prints full coverage for unexpected full-rule outcomes only. The original collector printed all passing coverage too, producing approximately 147 MB of log text. No paid artifacts or caches are used.
- Package tests verify the fixture and formatting changes locally; native correctness and evaluation margin remain to be verified by the GitHub run.

No website, published rules, or attendance data were modified by creating this package.
