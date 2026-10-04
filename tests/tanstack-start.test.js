import assert from "node:assert/strict";
import test from "node:test";

test("TanStack Start application entry resolves", () => {
  assert.ok(import.meta.resolve("@tanstack/react-start").includes("@tanstack/react-start"));
});