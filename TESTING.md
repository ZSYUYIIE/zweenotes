# Provider integration checks — 0.2.1

Recorded 2026-10-05. No credentials are included in this report.

## Unit checks

13 passed, 0 failed. Coverage includes fixed NVIDIA endpoints, supported Qwen workspace URLs, model IDs, provider-specific request settings, strict source-reference schemas, review flags, bounded chunks, credential isolation, HTTP/network error redaction, truncation and cancellation before a request starts.

Run with `npm test`.

## Isolated browser checks

Passed using headless local Chrome, a separate test context, fake credentials and mocked NVIDIA/Qwen responses. Seven mocked API requests; no page errors.

Checked settings and exact-origin permissions, saving without inference, explicit connection testing, separate provider keys, importing three original demo materials, generating referenced knowledge, A4 fit/print availability, same-provider cache reuse and cache separation across providers. The browser check does not use a real account or extension installation.

Run with `npm run test:browser` after installing development dependencies. The screenshot in ignored `test-artifacts` shows mocked content, not a live model response.

## Live NVIDIA checks

The production adapter used `nvidia/nemotron-3.5-lightning-30b-a3b` at NVIDIA's hosted endpoint. Three short, newly authored operating-systems examples were submitted using a process-only key.

| Example | Points | Time (ms) | Prompt tokens | Completion tokens |
| --- | ---: | ---: | ---: | ---: |
| Lecture: paging and scheduling | 2 | 3,885 | 466 | 130 |
| Tutorial: shared counter and mutex | 2 | 67,784 | 446 | 190 |
| Lab: compilation and debugging | 2 | 6,427 | 453 | 170 |

All three requests passed. Six points composed into the sheet data model; all had nonempty references to actual supplied source segments and retained their human-review flags. Total elapsed time was 78,102 ms.

Initial JSON-object requests returned missing source IDs and were rejected by validation. NVIDIA's strict JSON schema now requires nonempty references from the supplied ID enumeration. The prompt and point budget were also adjusted to reduce repetition.

Optional reproduction: supply `NVIDIA_API_KEY` through the process environment and run `npm run test:live -- --stdout`. This sends three examples and uses provider quota. Never save a key in the project.

## Limits

These examples are not an accuracy or performance benchmark. References establish traceability, not factual correctness. One request took about 68 seconds; requests retain the 90-second timeout and cancellation controls. Nemotron Super, live Qwen, actual Canvas accounts, full-course PDFs and final printer/PDF-driver output were not checked in this integration pass.

## Assessment workflow checks — 0.2.2

19 unit checks passed, including unresolved final coverage, suggested midterm boundaries, explicit ranges versus exclusions, sample-paper boundaries, later inclusion overrides and balanced method selection. The isolated Studio browser check also passed week suggestions, scope review gating and stored evidence. A separate mocked Canvas browser check passed current-course collection, filtering, HTML sanitization and pagination isolation. Run `npm run test:canvas` for that check.

A real CS3263 trial uses privately held original slides/tutorial PDFs and manually transcribed evidence read from the signed-in Canvas UI. The ignored `trial` folder holds its input, resumable source/chunk archive, PDF and detailed run report. It does not establish coverage of missing course material or video speech; do not publish those course files. The Canvas collector itself was checked against fixtures, not installed into the live browser during this run.
