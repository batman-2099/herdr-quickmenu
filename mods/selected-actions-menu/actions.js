// No startup work: these helpers are called only by an explicit menu action.
import { URL } from "url";
import { terminals, panes, spaces, focused, run, exec } from "herdr";

// Labels distinguish destinations (e.g. a parent); arguments distinguish commands
// such as split and worktree. Enabled state is read from the live row instead.
export function currentItem(shown, rows) {
  return shown && rows.find(([label, command, args]) => command === shown[1] &&
    label === shown[0] && JSON.stringify(args) === JSON.stringify(shown[2]));
}

export function matchesPane(target, allPanes) {
  const pane = allPanes.find(p => p.pane === target.pane);
  return pane ? target.modelPane !== false && pane.terminal === target.terminal : !target.modelPane;
}

export function safeURL(text) {
  const value = String(text ?? "").trim();
  if (!/^https?:\/\//i.test(value) || /[\s\u0000-\u001f\u007f\\]/.test(value))
    throw new Error("Select one complete http:// or https:// URL (no spaces).");
  const authority = value.match(/^https?:\/\/([^/?#]*)/i)?.[1];
  // Reject even empty userinfo, not just username/password getters.
  if (!authority || authority.includes("@")) throw new Error("URLs with credentials are not allowed.");
  let url;
  try { url = new URL(value); } catch (_) { throw new Error("The selected URL is not valid."); }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password)
    throw new Error("Only HTTP(S) URLs without credentials are allowed.");
  return url.href;
}

export function searchURL(text) {
  const value = String(text ?? "").trim();
  if (!value || value.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
    throw new Error("Select 1–4096 characters of text to search.");
  return "https://duckduckgo.com/?q=" + encodeURIComponent(value);
}

// Both machine membership and the address must prove this is a local pane.
// Never use a space's starting folder as a substitute for the live cwd.
export function localFolder(target, allPanes = panes(), allSpaces = spaces(), allTerms = terminals()) {
  if (!target?.terminal || target.terminal.includes("/")) return null;
  const pane = allPanes.find(p => p.pane === target.pane && p.terminal === target.terminal);
  const space = pane && allSpaces.find(s => (s.tabs ?? []).some(t => t.id === pane.tab));
  const term = allTerms.find(t => t.address === target.terminal);
  const cwd = term?.cwd || pane?.cwd;
  if (!pane || !space || space.machine !== null || !term || typeof cwd !== "string" ||
      !cwd.startsWith("/") || cwd.startsWith("//") || /[\u0000-\u001f\u007f]/.test(cwd)) return null;
  return cwd;
}

export function selectionOf(terminal) {
  return terminals().find(t => t.address === terminal)?.selection ?? null;
}

export function queueFocus(target) {
  run("pane.focus", target.modelPane ? { pane: target.pane } : { terminal: target.terminal });
}

function hasFocus(target) {
  const now = focused();
  return now?.terminal === target.terminal && (!now.shown || now.shown === target.terminal) &&
    (target.modelPane === undefined || now.pane === (target.modelPane ? target.pane : null));
}

export async function focusTarget(target, cx) {
  if (!target?.terminal || !matchesPane(target, panes()) || !terminals().some(t => t.address === target.terminal))
    throw new Error("That terminal is no longer available.");
  queueFocus(target);
  cx.notify();
  // run queues app commands. Let the foreground executor apply focus first.
  await cx.sleep(40);
  if (!hasFocus(target))
    throw new Error("Could not focus the clicked terminal; nothing was sent.");
}

export async function restoreIfPending(clipboard, marker, previous) {
  if (await clipboard("getClipboardContents") === marker)
    await clipboard("setClipboardContents", [previous]);
}

export async function selectedText(target, cx) {
  const selection = selectionOf(target?.terminal);
  if (!selection) throw new Error("Select text in this terminal first (Shift-drag if its program captures the mouse).");
  const signature = JSON.stringify(selection);
  const stillSelected = () => hasFocus(target) && JSON.stringify(selectionOf(target.terminal)) === signature;
  await focusTarget(target, cx);
  if (!stillSelected()) throw new Error("Focus or selection changed; select it again.");
  // This API exposes endpoints, not text. Use KDE's installed clipboard
  // service for a verified sentinel round trip: native context clipboard writes
  // did not reliably persist in background Wayland tests. Never use PRIMARY or
  // an unverified old clipboard as selection text. All calls are click-only.
  const clipboard = async (method, args = []) => {
    const result = await exec("qdbus6", ["org.kde.klipper", "/klipper", method, ...args], { timeout: 3000 });
    if (result.code !== 0) throw new Error("KDE clipboard service is unavailable. Nothing was opened.");
    return result.stdout.replace(/\n$/, "");
  };
  const previous = await clipboard("getClipboardContents");
  const marker = "herdr-selection-pending:" + Date.now() + ":" + Math.random();
  await clipboard("setClipboardContents", [marker]);
  if (await clipboard("getClipboardContents") !== marker)
    throw new Error("Clipboard verification failed. Nothing was opened.");
  if (!stillSelected()) {
    await restoreIfPending(clipboard, marker, previous);
    throw new Error("Focus or selection changed. Nothing was opened.");
  }
  run("terminal.copy");
  cx.notify();
  await cx.sleep(80);
  const text = await clipboard("getClipboardContents");
  if (text === marker || !text) {
    if (text === marker) await restoreIfPending(clipboard, marker, previous);
    throw new Error("The selected text could not be copied. Nothing was opened.");
  }
  if (!stillSelected())
    throw new Error("Focus or selection changed while copying. Nothing was opened.");
  return text;
}

export async function launchURL(url) {
  // KDE's launcher detaches GUI programs; exec's timeout must not kill a
  // newly started browser or Dolphin just because its window stays open.
  const result = await exec("kstart", ["--", "xdg-open", safeURL(url)], { timeout: 10000 });
  if (result.code !== 0) throw new Error("The default browser launcher failed.");
}

export async function openFolder(target) {
  const folder = localFolder(target);
  if (!folder) throw new Error("Dolphin is available only for a known local terminal folder.");
  const result = await exec("kstart", ["--", "dolphin", "--new-window", folder], { timeout: 10000 });
  if (result.code !== 0) throw new Error("Dolphin could not open the local folder.");
}
