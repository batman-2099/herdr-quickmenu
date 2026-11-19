# herdr.dev gallery preparation

Live official gallery checked on 2026-11-19: `https://herdr.dev/mods` redirects to `https://herdr.dev/gallery/`. The “Share yours” Mods section requires a public repository with topic `herdr-mod`, `mods/<name>/`, `RECIPE.md`, `preview.png`, optional keybindings, and no `layouts/` folder. It says indexing occurs within an hour and pictures are screened; mods themselves are not reviewed by Herdr. The installed Herdr 0.1.16 AGENTS.md agrees.

## Official gallery requirements

- [x] Code under `mods/selected-actions-menu/`.
- [x] Root `RECIPE.md` with a rebuild brief and preview reference.
- [x] Root `preview.png`: actual native popup, cropped to 430 × 430; final pixels inspected. No private terminal content, machine names, paths, or account data.
- [x] No `layouts/` folder; merge `terminal_menu` into a personal layout.
- [x] No keyboard rebinding required.
- [ ] Public GitHub repository created and exact commit read back.
- [ ] Repository topic `herdr-mod` set and read back.
- [ ] Community listing observed after indexing. Do not claim this from a successful push alone.

## Completed release preparation

- [x] User authorized publication to the intended account; `gh` authentication and API login agree on that account. No pre-existing target repository was found.
- [x] Upstream licensing verified against Herdr v0.1.16, commit `034f8b85f7e6bb71f8ff55cb4a80c548b2578c0f`: Apache-2.0. LICENSE copied verbatim, provenance and relevant icon notices in NOTICE, modified source and manifest marked.
- [x] Installed shipped menu matches the pinned upstream source byte-for-byte. Packaged runtime behavior remains unchanged from the active mod (only attribution comments and manifest notice added).
- [x] Herdr 0.1.16 native package check passes.
- [x] 32 validation tests executed in the native runtime with `python3 tests/run.py`: URL acceptance/rejection, search encoding/limits, local-folder ownership/path checks. These are unit tests, not live browser/clipboard tests.
- [x] Runtime dependencies present: `qdbus6`, `kstart`, `xdg-open`, Dolphin. Klipper's D-Bus interface responds; no private clipboard data needed for this check.
- [x] Actual live menu render inspected. Temporary preview helpers removed, prior focus restored, personal layout unchanged, existing background alert mod preserved.
- [x] Generated declarations/editor files ignored; no raw screenshot, personal configuration, clipboard capture, credentials, or diagnostic helper is included.

## Still unverified / not claimed working

- [ ] Full foreground action matrix on the exact package: selected URL/search, Copy/Paste/Select all, local-folder launch, split/zoom/close.
- [ ] Shift-drag and Shift-right-click inside mouse-capturing applications. Copy was user-reported working in a plain terminal, not on normal Hermes-owned highlights. This workaround is documented, not proven here.
- [ ] Live no-selection and stale-target refusal, including focus changes during clipboard extraction. Unsafe URL and remote-folder validation are unit-tested, not UI-tested.

Clipboard extraction is platform-specific and races other clipboard writers; failure restoration is incomplete for non-text clipboard formats/history. Read README.md before using it with sensitive data.

## Publication status

Prepared locally, not published. Git has no configured author name/email and `git var GIT_AUTHOR_IDENT` fails. Do not guess an email, derive a noreply address, or silently reuse an unconfirmed historical identity. Confirm and configure a repository-local identity before committing and publishing. No GitHub repository, topic, release, or gallery listing has been created by this preparation.
