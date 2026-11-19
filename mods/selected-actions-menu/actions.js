// No startup work: these helpers are called only by an explicit menu action.
import { URL } from "url";
import { platform } from "os";
import { terminals, panes, spaces, focused, run, exec } from "herdr";

const hostOS = platform();
export const folderManager = { linux: "Dolphin", macos: "Finder", windows: "File Explorer" }[hostOS];

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
export function localFolder(target, allPanes = panes(), allSpaces = spaces(), allTerms = terminals(), os = hostOS) {
  if (!target?.terminal || target.terminal.includes("/")) return null;
  const pane = allPanes.find(p => p.pane === target.pane && p.terminal === target.terminal);
  const space = pane && allSpaces.find(s => (s.tabs ?? []).some(t => t.id === pane.tab));
  const term = allTerms.find(t => t.address === target.terminal);
  // The core record's top-level cwd is the launch directory, not the cwd after cd.
  const cwd = term?.foreground?.cwd ?? pane?.cwd;
  if (!pane || !space || space.machine !== null || !term || typeof cwd !== "string" ||
      /[\u0000-\u001f\u007f]/.test(cwd)) return null;
  if (os === "windows") {
    // Drive-rooted only: neither C:relative, UNC, nor a device namespace.
    if (!/^[a-z]:[\\/]/i.test(cwd) || /[<>:"|?*]/.test(cwd.slice(2))) return null;
    return cwd.replace(/\//g, "\\");
  }
  return cwd.startsWith("/") && !cwd.startsWith("//") ? cwd : null;
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

export function restoreIfPending(cx, marker, previous) {
  if (typeof previous === "string" && cx.read_from_clipboard() === marker)
    cx.write_to_clipboard(previous);
}

// Klipper's getClipboardContents reads history item 0. Observe both the marker
// and its replacement on the terminal's live clipboard instead.
export async function waitForClipboard(cx, marker, expectMarker, stillSelected, published) {
  for (let elapsed = 0; elapsed <= 1000; elapsed += 25) {
    if (!stillSelected()) throw new Error("Focus or selection changed. Nothing was opened.");
    const text = cx.read_from_clipboard();
    if (text && (text === marker) === expectMarker && (!published || await published())) return text;
    if (elapsed < 1000) await cx.sleep(25);
  }
  throw new Error(expectMarker ? "Clipboard verification failed. Nothing was opened." :
    "Native Copy did not deliver the selected text. Nothing was opened.");
}

export async function selectedText(target, cx) {
  const selection = selectionOf(target?.terminal);
  if (!selection) throw new Error("Select text in this terminal first (Shift-drag if its program captures the mouse).");
  const signature = JSON.stringify(selection);
  const stillSelected = () => hasFocus(target) && JSON.stringify(selectionOf(target.terminal)) === signature;
  await focusTarget(target, cx);
  if (!stillSelected()) throw new Error("Focus or selection changed; select it again.");
  const previous = cx.read_from_clipboard();
  const marker = "herdr-selection-pending:" + Date.now() + ":" + Math.random();
  try {
    // KWin rejects an application's Copy if a Klipper write used a newer
    // serial than the menu click. Let Herdr own both writes; Klipper only
    // witnesses publication of the marker, never supplies the selected text.
    cx.write_to_clipboard(marker);
    await waitForClipboard(cx, marker, true, stillSelected, hostOS === "linux" ? async () => {
      const reply = await exec("qdbus6", ["org.kde.klipper", "/klipper", "getClipboardContents"], { timeout: 3000 });
      if (reply.code !== 0) throw new Error("KDE clipboard service is unavailable. Nothing was opened.");
      return reply.stdout.replace(/\n$/, "") === marker;
    } : undefined);
    if (!stillSelected() || cx.read_from_clipboard() !== marker)
      throw new Error("Focus, selection or clipboard changed. Nothing was opened.");
    run("terminal.copy");
    cx.notify();
    return await waitForClipboard(cx, marker, false, stillSelected);
  } catch (error) {
    restoreIfPending(cx, marker, previous);
    throw error;
  }
}

export async function launchURL(url, cx) {
  const address = safeURL(url);
  if (hostOS !== "linux") {
    cx.open_url(address);
    return;
  }
  const result = await exec("kstart", ["--", "xdg-open", address], { timeout: 10000 });
  if (result.code !== 0) throw new Error("The default browser launcher failed.");
}

export async function openFolder(target) {
  const folder = localFolder(target);
  if (!folder) throw new Error("The clicked terminal has no known local folder.");
  let result;
  if (hostOS === "windows") {
    // Pass the path as cwd, never as PowerShell source. A missing directory
    // prevents process startup rather than opening Explorer's default folder.
    result = await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "Invoke-Item -LiteralPath (Get-Location).ProviderPath -ErrorAction Stop"], { cwd: folder, timeout: 10000 });
  } else if (hostOS === "macos") {
    result = await exec("/usr/bin/open", ["-b", "com.apple.finder", "."], { cwd: folder, timeout: 10000 });
  } else {
    result = await exec("kstart", ["--", "dolphin", "--new-window", folder], { timeout: 10000 });
  }
  if (result.code !== 0) throw new Error(`${folderManager} could not open the local folder.`);
}
