import { safeURL, searchURL, localFolder, currentItem, matchesPane, restoreIfPending } from "./actions.js";
export async function validate() {
  const passed = [];
  function test(name, fn) { fn(); passed.push(name); }
  function eq(a, b) { if (a !== b) throw new Error(JSON.stringify({expected:b, actual:a})); }
  function rejects(fn) { let rejected = false; try { fn(); } catch (_) { rejected = true; } if (!rejected) throw new Error("Expected rejection"); }
  test("https URL", () => eq(safeURL("https://example.com/a?q=1&b=2#c"), "https://example.com/a?q=1&b=2#c"));
  test("trim outer whitespace", () => eq(safeURL("  http://localhost:3000/a  "), "http://localhost:3000/a"));
  test("IPv6 URL", () => eq(safeURL("http://[::1]:8080/a"), "http://[::1]:8080/a"));
  for (const value of ["", "example.com", "file:///etc/passwd", "javascript:alert(1)", "ftp://example.com", "https://user:pass@example.com", "https://@example.com", "https://user@example.com", "https://example.com\\@evil.com", "https://example.com/\nattack", "https://example.com/a b", "https://", "https://%40example.com", "https://example.com:bad", "--help"]) {
    test("reject URL " + JSON.stringify(value), () => rejects(() => safeURL(value)));
  }
  test("search encodes shell punctuation and Unicode", () => eq(searchURL("hello & $(id) café"), "https://duckduckgo.com/?q=hello%20%26%20%24(id)%20caf%C3%A9"));
  test("empty search rejected", () => rejects(() => searchURL("  ")));
  test("huge search rejected", () => rejects(() => searchURL("x".repeat(4097))));
  test("control character search rejected", () => rejects(() => searchURL("a\u0000b")));
  const park = ["Send back to parent", "terminal.park", {terminal:"t1"}];
  const close = ["Close pane", "pane.close", {pane:"p1"}];
  test("removed parent action never becomes Close pane", () => eq(currentItem(park, [close]), undefined));
  test("Close pane keeps its identity after a preceding row disappears", () => eq(currentItem(close, [close]), close));
  const split = ["Split", "pane.split", {pane:"p1", direction:"down"}];
  test("same command cannot pick a different split direction", () => eq(currentItem(split, [
    ["Split", "pane.split", {pane:"p1", direction:"right"}]
  ]), undefined));
  const target = { pane: "p1", terminal: "t1" };
  const panes = [{pane:"p1", terminal:"t1", tab:"tab1", cwd:"/old"}];
  const model = {...target, modelPane:true};
  test("original pane still owns the terminal", () => eq(matchesPane(model, panes), true));
  test("terminal moved to another pane", () => eq(matchesPane(model, [
    {...panes[0], terminal:"t2"}, {...panes[0], pane:"p2"}
  ]), false));
  test("deleted model pane is not a layout block", () => eq(matchesPane(model, []), false));
  test("layout block may show a model terminal", () => eq(matchesPane(
    {...target, pane:"block", modelPane:false}, panes), true));
  const spaces = [{machine:null, tabs:[{id:"tab1"}]}];
  const terms = [{address:"t1", cwd:"/home/test/folder with ' quotes; $(id)"}];
  test("current local cwd, literal punctuation", () => eq(localFolder(target, panes, spaces, terms), terms[0].cwd));
  test("remote machine refused", () => eq(localFolder(target, panes, [{...spaces[0],machine:"remote"}], terms), null));
  test("unknown machine refused", () => eq(localFolder(target, panes, [{tabs:spaces[0].tabs}], terms), null));
  const remote = "remote/t1";
  test("remote address refused", () => eq(localFolder({...target, terminal:remote},
    [{...panes[0], terminal:remote}], spaces, [{...terms[0], address:remote}]), null));
  test("missing live cwd never uses space folder", () => eq(localFolder(target,
    [{...panes[0], cwd:null}], [{...spaces[0], folder:"/start"}], [{...terms[0], cwd:null}]), null));
  test("composition block refused", () => eq(localFolder({...target,pane:"block"}, panes, spaces, terms), null));
  test("replaced terminal refused", () => eq(localFolder(target, [{...panes[0],terminal:"t2"}], spaces, terms), null));
  test("URI cwd refused", () => eq(localFolder(target, panes, spaces, [{...terms[0],cwd:"sftp://host/home"}]), null));
  test("relative cwd refused", () => eq(localFolder(target, panes, spaces, [{...terms[0],cwd:"relative"}]), null));
  test("UNC cwd refused", () => eq(localFolder(target, panes, spaces, [{...terms[0],cwd:"//host/share"}]), null));
  test("control cwd refused", () => eq(localFolder(target, panes, spaces, [{...terms[0],cwd:"/a\nb"}]), null));
  for (const initial of ["pending", "another writer"]) {
    let text = initial;
    const clipboard = async (method, args) => {
      if (method === "getClipboardContents") return text;
      if (method !== "setClipboardContents") throw new Error("Unexpected clipboard method");
      text = args[0];
    };
    await restoreIfPending(clipboard, "pending", "previous");
    test("restore clipboard: " + initial, () => eq(text, initial === "pending" ? "previous" : initial));
  }
  return passed;
}
