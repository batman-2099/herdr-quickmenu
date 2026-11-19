import { safeURL, searchURL, localFolder } from "./actions.js";
export function validate() {
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
  const target = { pane: "p1", terminal: "t1" };
  const panes = [{pane:"p1", terminal:"t1", tab:"tab1", cwd:"/old"}];
  const spaces = [{machine:null, tabs:[{id:"tab1"}]}];
  const terms = [{address:"t1", cwd:"/home/test/folder with ' quotes; $(id)"}];
  test("current local cwd, literal punctuation", () => eq(localFolder(target, panes, spaces, terms), terms[0].cwd));
  test("remote machine refused", () => eq(localFolder(target, panes, [{...spaces[0],machine:"remote"}], terms), null));
  test("unknown machine refused", () => eq(localFolder(target, panes, [{tabs:spaces[0].tabs}], terms), null));
  test("remote address refused", () => eq(localFolder({...target,terminal:"remote/t1"}, panes, spaces, terms), null));
  test("composition block refused", () => eq(localFolder({...target,pane:"block"}, panes, spaces, terms), null));
  test("replaced terminal refused", () => eq(localFolder(target, [{...panes[0],terminal:"t2"}], spaces, terms), null));
  test("URI cwd refused", () => eq(localFolder(target, panes, spaces, [{...terms[0],cwd:"sftp://host/home"}]), null));
  test("relative cwd refused", () => eq(localFolder(target, panes, spaces, [{...terms[0],cwd:"relative"}]), null));
  test("UNC cwd refused", () => eq(localFolder(target, panes, spaces, [{...terms[0],cwd:"//host/share"}]), null));
  test("control cwd refused", () => eq(localFolder(target, panes, spaces, [{...terms[0],cwd:"/a\nb"}]), null));
  return passed;
}
