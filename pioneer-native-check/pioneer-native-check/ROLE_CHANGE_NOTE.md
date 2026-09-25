# Role cutover candidate — September 25, 2026

Emulator-only candidate. Do not publish `emulator-only.rules`.

Production identities represented by fictional UIDs in this native suite:

- Shared kiosk: `field@pioneerelectricgrp.com` / `x0rz86ZAguRMYdrEznbH1eMq1lG3`
- Management: Isaac / `d3GUR1ht0DQSss1mS5t9jOgChfq2`
- Management: Jake / `hnLcbI2FI1eeQhhmxjxXnVpgwpG2`
- Management: Eric / `XfYuiG6r22V3Hxr7vobDD0Q8G5j1`

The current application has two operational permission levels: full management and restricted kiosk. Eric receives the full management level. A distinct owner-only tier is not introduced in this candidate.

Future Authentication users receive no board permission until their UID is explicitly added to the tested management allowlist and the live webpage.
