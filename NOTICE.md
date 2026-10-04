# Attribution and modification notice

This project is a modified derivative of **Panopto Downloader** by Travis Bender (`travbend/panopto-downloader`).

Upstream source: https://github.com/travbend/panopto-downloader
Upstream license: GNU General Public License v3.0 (GPL-3.0)

Modifications made on 2026-09-24 include support for additional Panopto regional domains, robust delayed UI insertion, a simplified Manifest V3 architecture, removal of the upstream conversion-server dependency from the public-store build, reduced Chrome permissions, and direct downloading of MP4/Podcast streams exposed by Panopto. The NUS-first prototype changes made on 2026-09-25 add Canvas course context, per-tab session storage, and a Chrome side panel. No Canvas or Panopto course content is sent to a ZweeNotes backend.

This modified work is distributed under GPL-3.0. See `LICENSE`.

The 0.2.0 development changes made on 2026-09-30 add a persistent course library, read-only Canvas module discovery, local text/PDF/subtitle imports, user-configured Qwen summaries, knowledge-point provenance, a trouble-topic ledger, an editable A4 cheatsheet studio and bundled local rendering dependencies. Qwen generation sends selected source text directly to the user's configured Alibaba Model Studio endpoint. See `PRIVACY.md` and `THIRD_PARTY.md`.

The 0.2.1 development changes made on 2026-10-05 add NVIDIA Nemotron alongside Qwen, separate provider keys and caches, strict NVIDIA structured outputs, explicit connection testing and integration checks. No developer API key is included in the distributed extension.

The 0.2.2 development changes made on 2026-10-05 add local Canvas assessment evidence, reviewed midterm/final scope selection, conservative week/exclusion suggestions and balanced point selection across materials. Private course trial inputs and outputs are excluded from version control and the extension package.
