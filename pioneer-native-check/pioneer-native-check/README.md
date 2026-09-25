# Pioneer v19 — Role Cutover native candidate

**Emulator only. Do not publish `emulator-only.rules`. Real attendance is already live; this package changes no production system by itself.**

Goal: keep the shared kiosk restricted under a new field account while giving Isaac, Jake, and Eric full management authority. The native suite uses fictional UIDs only.

## Upload and run

1. Replace the files inside the repository's existing `pioneer-native-check` folder with all files in this folder.
2. Commit to `main` with message `Test field kiosk and three managers`.
3. Open **Actions → Pioneer native rule diagnosis → Run workflow → main** and start a new run.

Required summary:

- **ROLE CUTOVER CANDIDATE — PATCH 4 LOGIC**
- **112/112** full-rule expectations
- **0** native budget failures
- **0** incomplete native evidence
- **Native acceptance gate: PASS**

The original 101 accepted Patch 4 cases are retained. Eleven role regressions prove: the field account can read/punch as the kiosk; the field account remains denied office operations; Isaac, Jake, and Eric can read the office configuration and perform the tested crew/approval actions; unauthorized users remain denied.

Do not paste emulator rules into Firebase. After the native PASS, use the separately packaged production rules and strict HTML role patcher.

## Future superintendent accounts

Creating a Firebase Authentication user does **not** grant board access by itself. Each new superintendent UID must be added to the approved management allowlist in both the tested rules and the live webpage, then revalidated before publication. This deliberate step prevents an accidentally created user from receiving management authority.
