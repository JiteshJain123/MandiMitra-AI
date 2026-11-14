# Development timeline

This page records what is actually known about how MandiMitra AI was built, and separates **verified** history from work done **today**. It does not assign dates to anything that cannot be verified.

## How to read this

- **Verified record:** taken from the commit history of the project's original private development repository (times are IST) and from the dated sections of [TEST_REPORT.md](TEST_REPORT.md) and [PROJECT_PLAN.md](PROJECT_PLAN.md). That original history is not published.
- **This repository:** created on 2026-11-14 with a fresh history. Every commit here carries the real time it was made, so its commit dates (all 2026-11-14) show when the repository was assembled, **not** when the work was first done.
- The project was developed with AI coding assistance.
- Challenge deadline: 15 November 2026, 18:00 IST.

## Day by day

| Date | Status | What the records show |
|---|---|---|
| 10 Nov 2026 | No record | No commit, report or backup in the repository or its original history is dated this day. Nothing is claimed. |
| 11 Nov 2026 | No record | As above. |
| 12 Nov 2026 | No record | As above. |
| 13 Nov 2026 | Verified | First commit at 16:14. By 16:54 the monorepo, shared schemas, calculation and extraction, the backend with Gnani Prisma and Timbre, the React frontend with end-to-end tests, CI/CD and Docker configuration, the documentation and the project plan were all committed. In the evening (21:47 to 22:32): a Hindi "per unit" fix, the smoke test and the `npm run doctor` check, then fixes for extraction, voice-answer and layout bugs found in local testing, and a regenerated lockfile. A hardening of the deploy workflow was prepared at 23:09 and 23:41 on a separate branch; it is **not** part of this repository. The first full test run recorded in the test report that day had 96 API, 11 web and 4 end-to-end tests. |
| 14 Nov 2026 | Verified | In the original repository: help and onboarding for new users (11:30); microphone error handling, accessibility and phone-layout fixes (12:06); corrected test counts, the deployment guide, the one-page pitch, the demo script and an architecture note (12:55 to 14:45). The dated sections of the test report record a 51-check voice workflow in Hindi, Hinglish and English, an accessibility and responsive review, and a clean-clone run with 106 API, 48 web and 10 end-to-end tests. |
| 14 Nov 2026 | Done today, in this repository | The repository was re-created with a fresh history (15:50), the README was redesigned twice (16:03 and 16:18), and then the source-code link, local troubleshooting guidance, the fresh-repository test results and this timeline were committed. GitHub Actions `CI` and `Deploy` concluded successfully on the first pushed commit. |
| 15 Nov 2026 | Not done yet | Planned before the 18:00 IST deadline: record the demo video, publish the public post, and submit the form. Nothing here is complete at the time of writing. |

## What was not done

- Nothing was deployed. No live site exists.
- Accuracy on real accents and noisy audio has not been measured.
- Dispute comparison and a voice stress-test page were planned but not built.

## Sources

| Claim | Where to check |
|---|---|
| Test counts and run dates | [TEST_REPORT.md](TEST_REPORT.md) |
| Phase status and the first-day plan | [PROJECT_PLAN.md](PROJECT_PLAN.md) |
| Commit times in this repository | `git log` on this repository |
