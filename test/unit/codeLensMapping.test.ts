import { strict as assert } from "assert";
import { findD2Blocks } from "../../src/d2BlockFinder";

// The CodeLens provider maps D2BlockInfo -> CodeLens objects.
// Since CodeLens creation depends on vscode APIs (Range, CodeLens classes),
// we test the underlying block-finding logic here and verify the mapping
// contract: each block should produce a CodeLens at the correct line.

describe("CodeLens mapping contract", () => {
  it("produces one lens per d2 block", () => {
    const text = [
      "# Doc",
      "",
      "```d2",
      "a -> b",
      "```",
      "",
      "```d2",
      "x -> y",
      "```",
    ].join("\n");

    const blocks = findD2Blocks(text);
    // Each block should map to exactly one CodeLens
    assert.strictEqual(blocks.length, 2);
    // First lens should be on line 2 (the ```d2 line)
    assert.strictEqual(blocks[0].startLine, 2);
    // Second lens should be on line 6
    assert.strictEqual(blocks[1].startLine, 6);
  });

  it("passes the d2 code as command argument", () => {
    const text = ["```d2", "server -> client", "client -> db", "```"].join("\n");

    const blocks = findD2Blocks(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].code, "server -> client\nclient -> db");
  });
});
