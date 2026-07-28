import test from "node:test";
import assert from "node:assert/strict";
import { matchCommand } from "./commandMatcher.js";

test("matches common mishears for menu options", () => {
  assert.deepEqual(
    matchCommand("wise", ["voice", "mouse", "human", "ai", "black", "white", "easy", "medium", "hard"]),
    {
      command: "voice",
      normalized: "wise",
      matchedBy: "alias",
    }
  );

  assert.deepEqual(
    matchCommand("mice", ["voice", "mouse", "human", "ai", "black", "white", "easy", "medium", "hard"]),
    {
      command: "mouse",
      normalized: "mice",
      matchedBy: "alias",
    }
  );

  assert.deepEqual(
    matchCommand("whyte", ["voice", "mouse", "human", "ai", "black", "white", "easy", "medium", "hard"]),
    {
      command: "white",
      normalized: "whyte",
      matchedBy: "alias",
    }
  );
});
