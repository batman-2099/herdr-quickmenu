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
- [x] Installed shipped menu matched the pinned upstream source byte-for-byte during initial preparation. The active custom mod was backed up before the clipboard and cwd fixes were installed.
- [x] Herdr 0.1.16 native checks passed for both the packaged mod and the installed copy.
- [x] 49 validation cases passed, including delayed clipboard publication/delivery, refusal on timeout or focus loss, and cwd changes after launch. Clipboard cases use synthetic text.
- [x] Foreground retest by the user: Open URL opened the selected URL, DuckDuckGo showed the selected query, and Dolphin opened the current directory after `cd`.
- [x] Runtime dependencies present: `qdbus6`, `kstart`, `xdg-open`, Dolphin. Klipper's D-Bus interface responds; no private clipboard data needed for this check.
- [x] Original live popup inspected for the preview. A separate hidden-window check of the remediated menu with a removed model pane rendered no Split or Close pane action; this did not exercise input or clipboard delivery.
- [x] Generated declarations/editor files ignored; no raw screenshot, personal configuration, clipboard capture, credentials, or diagnostic helper is included.

## Still unverified / not claimed working

- [ ] Remaining foreground action matrix on the exact package: Copy/Paste/Select all and split/zoom/close.
- [ ] Shift-drag and Shift-right-click inside mouse-capturing applications. Copy was user-reported working in a plain terminal, not on normal Hermes-owned highlights. This workaround is documented, not proven here.
- [ ] Live no-selection and stale-target refusal: remove a parent while “Send back” is highlighted, move a terminal between panes, and change focus during extraction. Check model panes, layout blocks, and temporarily shown terminals separately.

Clipboard extraction is platform-specific and races other clipboard writers; failure restoration is incomplete for non-text clipboard formats/history. Read README.md before using it with sensitive data.

## Publication status

Prepared locally, not published. Git has no configured author name/email and `git var GIT_AUTHOR_IDENT` fails. Do not guess an email, derive a noreply address, or silently reuse an unconfirmed historical identity. Confirm and configure a repository-local identity before committing and publishing. No GitHub repository, topic, release, or gallery listing has been created by this preparation.
