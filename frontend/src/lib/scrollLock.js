/**
 * Reference-counted page scroll lock.
 *
 * The console scrolls `.main`, not the document, so a modal that freezes only
 * `document.body` still lets the content behind it scroll. Both are frozen here.
 *
 * Counting matters because a modal nests: the focus trap locks on open, and any
 * nested overlay locks again. Without counting, the inner release would restore
 * scrolling while the modal was still open.
 */

/** Everything that can scroll behind a modal. */
function scrollTargets() {
  const targets = [document.body];
  const main = document.querySelector(".main");
  if (main) targets.push(main);
  return targets;
}

let depth = 0;
let saved = null;

/**
 * Freeze page scrolling.
 * @returns {() => void} release function; safe to call more than once.
 */
export function lockPageScroll() {
  if (typeof document === "undefined") return () => {};

  depth += 1;
  if (depth === 1) {
    saved = scrollTargets().map((element) => ({ element, overflow: element.style.overflow }));
    for (const { element } of saved) element.style.overflow = "hidden";
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    depth = Math.max(0, depth - 1);
    if (depth > 0 || !saved) return;

    for (const { element, overflow } of saved) element.style.overflow = overflow;
    saved = null;
  };
}
