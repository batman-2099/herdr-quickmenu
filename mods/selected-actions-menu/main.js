// SPDX-License-Identifier: Apache-2.0
// Modified for Herdr QuickMenu: selected-text browser/search, clipboard and
// local-folder actions, disabled/busy states, and additional separators.
// Derived from herdrdev/herdr-app v0.1.16; see NOTICE for pinned provenance.
// Context menus (Herdr's items). Opened as a popup with
// props { tab: "pane" | "tab" | "space" | "global", target }.
// ↑/↓ move, Enter runs, Esc closes. An item is [label, command, args];
// a command "worktree" opens the worktree dialog instead.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec, notify } from "herdr";
import { currentItem, matchesPane, searchURL, localFolder, selectedText, queueFocus, focusTarget, launchURL, openFolder } from "./actions.js";

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// A space's checkout: "main" (a repo's own), "linked" (a worktree), or null.
async function checkout(folder, on) {
  const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder, on });
  const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder, on });
  if (top.code !== 0 || common.code !== 0) return null;
  return common.stdout.trim() === `${top.stdout.trim()}/.git` ? "main" : "linked";
}

function items(p, git) {
  p = p ?? {};
  const tg = p.target ?? {};
  switch (p.tab) {
    case "pane": {
      // A kept sub-agent can go back under its parent, still running.
      const all = terminals();
      const allPanes = panes();
      const term = matchesPane(tg, allPanes) && all.find((t) => t.address === tg.terminal);
      const parent = term?.parent && all.find((t) => t.address === term.parent);
      // Once they go to the program, Shift+right-click still opens this menu.
      const toProgram = term?.labels?.["herdr.right-click"] === "program";
      // A terminal shown outside a tab (a layout terminal block, a window) has
      // no pane to split, zoom or close: its pane is the block's id.
      const inTab = tg.modelPane && term;
      return [
        ["Open selected URL in browser", "selected.url", tg, !!term?.selection],
        ["Search selected text (DuckDuckGo)", "selected.search", tg, !!term?.selection],
        // Native Copy owns selection handling; do not require the mod's
        // coordinate metadata just to dispatch a clipboard-copy command.
        ["Copy", "selected.copy", tg, !!term],
        ["Paste", "selected.paste", tg, !!term],
        ["Select all", "selected.all", tg, !!term],
        ["Open local folder in Dolphin", "selected.folder", tg, !!inTab && !!localFolder(tg, allPanes, spaces(), all)],
        ...(inTab
          ? [
              ["Split right", "pane.split", { direction: "right", pane: tg.pane }],
              ["Split down", "pane.split", { direction: "down", pane: tg.pane }],
              ["Zoom", "pane.zoom", { pane: tg.pane }],
            ]
          : []),
        ...(term
          ? [
              toProgram
                ? ["Use Herdr right-click menu", "terminal.right_click", { terminal: term.address, to: "menu" }]
                : ["Send right-clicks to pane", "terminal.right_click", { terminal: term.address, to: "program" }],
            ]
          : []),
        ...(parent ? [[`Send back to ${parent.name || parent.address}`, "terminal.park", { terminal: term.address }]] : []),
        ...(inTab ? [["Close pane", "pane.close", { pane: tg.pane }]] : []),
      ];
    }
    case "tab":
      return [
        ["Rename", "tab.rename", { id: tg.id }],
        ["New tab", "tab.new", { space: tg.space }],
        ["Close", "tab.close", { id: tg.id }],
      ];
    case "space":
      return [
        ["Rename", "space.rename", { id: tg.id }],
        ...(git ? [["New worktree", "worktree", { space: tg.id, action: "new" }], ["Open worktree", "worktree", { space: tg.id, action: "open" }]] : []),
        ...(git === "linked" ? [["Remove worktree", "worktree", { space: tg.id, action: "remove" }]] : []),
        ["Close", "space.close", { id: tg.id }],
      ];
    default:
      return [
        ["New space", "space.new", {}],
        ["Keybinds", "app.help", {}],
        ["Theme: graphite", "app.theme", { name: "graphite" }],
        ["Theme: ink", "app.theme", { name: "ink" }],
        ["Theme: moss", "app.theme", { name: "moss" }],
        ["Theme: atom one dark", "app.theme", { name: "atom-one-dark" }],
      ];
  }
}

function menuIcon(command) {
  const name = command.endsWith(".close") ? "x" : command.endsWith(".rename") ? "square-pen" : command.endsWith(".new") ? "plus" : command === "worktree" ? "git-branch" : command === "app.help" ? "terminal" : command === "app.theme" ? "settings" : command === "pane.split" ? "panel-right" : command === "pane.zoom" ? "square" : "terminal";
  return `mods/workspace-chrome/${name}.svg`;
}

// The key bound to a command, for the hint on the right.
function shortcut(name, args) {
  // `pane.split:right` binds pane.split with { direction: "right" }.
  const value = args && Object.values(args)[0];
  const k = keys().find((b) => b.section === "global" && (b.action === name || b.action === `${name}:${value}`));
  return k ? k.keys : "";
}

export default class Menu extends View {
  init(_props, cx) {
    this.git = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    const p = props();
    // Remember whether the click was in a model pane: a vanished pane must
    // not be reclassified as a layout block on the next redraw.
    this.menu = p?.tab === "pane" ? { ...p, target: { ...p.target,
      modelPane: panes().some(pane => pane.pane === p.target?.pane) } } : p;
    const space = p?.tab === "space" && spaces().find((s) => s.id === p.target?.id);
    const folder = space && place(space);
    if (folder)
      cx.spawn(async (cx) => {
        this.git = await checkout(folder, space.machine).catch(() => null);
        cx.notify();
      });
  }

  choose(shown, cx) {
    if (!shown || shown[3] === false || this.busy) return;
    const it = currentItem(shown, items(this.menu, this.git));
    if (!it || it[3] === false) return;
    if (it[1] === "selected.copy") {
      // Match the shipped menu: close the keyboard-owning popup before
      // dispatching. Queue the clicked target and Copy in the same callback;
      // an async task must not retain the popup while copying.
      closeOverlay(props()?.overlay);
      queueFocus(it[2]);
      run("terminal.copy");
      return;
    }
    if (it[1].startsWith("selected.")) {
      const overlay = props()?.overlay;
      this.busy = true;
      cx.notify();
      cx.spawn(async (cx) => {
        try {
          if (it[1] === "selected.url") await launchURL(await selectedText(it[2], cx));
          else if (it[1] === "selected.search") await launchURL(searchURL(await selectedText(it[2], cx)));
          else if (it[1] === "selected.folder") await openFolder(it[2]);
          else if (it[1] === "selected.all" || it[1] === "selected.paste") {
            await focusTarget(it[2], cx);
            if (it[1] === "selected.paste") run("terminal.paste");
            else run("terminal.select_all", { terminal: it[2].terminal });
          } else throw new Error("Unknown terminal menu action.");
          closeOverlay(overlay);
        } catch (error) {
          this.busy = false;
          this.handle.focus();
          notify({ title: "Terminal menu", body: String(error.message ?? error), level: "error" });
          cx.notify();
        }
      });
      return;
    }
    closeOverlay(props()?.overlay);
    if (it[1] === "worktree") openOverlay({ mod: "worktree", kind: "dialog", ...(it[2].action === "open" ? { width: 560, height: 480 } : { width: 440, height: 260 }), props: it[2] });
    else run(it[1], it[2]);
  }

  render(cx) {
    const t = theme();
    const list = items(this.menu, this.git);
    this.highlight ??= list[0];
    const selected = currentItem(this.highlight, list);
    const at = list.indexOf(selected);
    return v_flex()
      .id("menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.highlight = list[(at + 1) % list.length];
        else if (e.key === "up") this.highlight = list[at <= 0 ? list.length - 1 : at - 1];
        else if (e.key === "enter") this.choose(selected, cx);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .children(
        list.map((it, i) =>
          v_flex()
            .when(i > 0 && (it[1] === "selected.copy" || it[1] === "selected.folder" || (it[1] === "pane.split" && list[i - 1][1] !== "pane.split") || it[1].endsWith(".close") || it[1] === "app.help" || (it[1] === "app.theme" && list[i - 1][1] !== "app.theme")), el => el.child(div().mx(7).my(4).h(1).bg(t.border)))
            .child(h_flex()
            .id(`mi-${it[0]}`)
            .h(31)
            .px(8)
            .gap(9)
            .rounded(7)
            .items_center()
            .justify_between()
            .text_color(it[3] === false || this.busy ? t.dim : t.foreground)
            .when(it === selected, (el) => el.bg(t.selected))
            .hover((s) => s.bg(t.hover))
            .on_click((_e, cx) => this.choose(it, cx))
            .child(svg(menuIcon(it[1])).size(14).flex_none().text_color(t.muted))
            .child(div().flex_1().child(it[0]))
            .child(div().text_size(11).text_color(t.dim).child(it[1].startsWith("selected.") ? "" : shortcut(it[1], it[2])))),
        ),
      );
  }
}
