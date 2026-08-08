import assert from "node:assert/strict";
import test from "node:test";
import { floatingPopoverLayout } from "../app/floating-popover.mjs";

test("popover opens downward by default and stays inside the viewport", () => {
  const down = floatingPopoverLayout({
    anchor: { top: 100, bottom: 140, left: 80 },
    popoverWidth: 210,
    popoverHeight: 240,
    viewportWidth: 800,
    viewportHeight: 700,
  });
  assert.deepEqual(down, {
    left: 80,
    top: 150,
    width: 210,
    maxHeight: 538,
    placement: "bottom",
  });

  const up = floatingPopoverLayout({
    anchor: { top: 620, bottom: 660, left: 760 },
    popoverWidth: 210,
    popoverHeight: 300,
    viewportWidth: 800,
    viewportHeight: 700,
  });
  assert.equal(up.placement, "top");
  assert.equal(up.top, 310);
  assert.equal(up.left, 578);
});
