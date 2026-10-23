import assert from "node:assert/strict";

// Resolved via a non-literal specifier so `tsc` (moduleResolution: "bundler",
// which disallows literal ".ts" import specifiers without
// allowImportingTsExtensions) does not try to statically resolve this as a
// ".ts" import, while Node's runtime type-stripping can still load the real
// "./use-swipe.ts" file directly when this test is run with
// `node lib/use-swipe.test.ts`.
const useSwipeModuleUrl = new URL("./use-swipe.ts", import.meta.url).href;
const { classifySwipe, isIgnoredSwipeTarget } = (await import(
  useSwipeModuleUrl
)) as {
  classifySwipe: (
    dx: number,
    dy: number,
    opts?: { threshold?: number; maxAngleDeg?: number },
  ) => "left" | "right" | null;
  isIgnoredSwipeTarget: (el: Element | null) => boolean;
};

// Pure left swipe beyond threshold
assert.equal(classifySwipe(-120, 5), "left", "pure left swipe should be 'left'");

// Pure right swipe beyond threshold
assert.equal(classifySwipe(120, -5), "right", "pure right swipe should be 'right'");

// Vertical scroll
assert.equal(classifySwipe(5, 300), null, "vertical scroll should be null");

// Too-short horizontal flick
assert.equal(classifySwipe(40, 0), null, "short horizontal flick should be null");

// Diagonal swipe outside the 30deg cone
assert.equal(classifySwipe(-100, 90), null, "diagonal swipe outside cone should be null");

// Near-zero gesture
assert.equal(classifySwipe(0, 0), null, "near-zero gesture should be null");

// Boundary: angle slightly under 30deg, distance over threshold => "right"
const angleDeg = 29;
const dx = 100;
const dy = dx * Math.tan((angleDeg * Math.PI) / 180);
assert.equal(
  classifySwipe(dx, dy),
  "right",
  "swipe just under the 30deg boundary and over threshold should be 'right'",
);

// Custom options are respected
assert.equal(
  classifySwipe(-50, 5, { threshold: 40 }),
  "left",
  "custom lower threshold should allow a smaller dx to count",
);
assert.equal(
  classifySwipe(-50, 5, { threshold: 60 }),
  null,
  "dx under a higher custom threshold should be null",
);

// isIgnoredSwipeTarget: true when closest() matches an ignored selector
const matchingEl = {
  closest: (sel: string) => (sel.includes("textarea") ? ({} as Element) : null),
} as unknown as Element;
assert.equal(isIgnoredSwipeTarget(matchingEl), true, "should ignore when closest matches");

// isIgnoredSwipeTarget: false when closest() returns null
const nonMatchingEl = {
  closest: () => null,
} as unknown as Element;
assert.equal(isIgnoredSwipeTarget(nonMatchingEl), false, "should not ignore when closest finds nothing");

// isIgnoredSwipeTarget: false for null element
assert.equal(isIgnoredSwipeTarget(null), false, "null element should not be ignored");

console.log("PASS: use-swipe.test.ts — all assertions passed");
