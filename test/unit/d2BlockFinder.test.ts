import { strict as assert } from "assert";
import { findD2Blocks } from "../../src/d2BlockFinder";

describe("findD2Blocks", () => {
  it("returns empty array for empty document", () => {
    assert.deepStrictEqual(findD2Blocks(""), []);
  });

  it("returns empty array when no fenced code blocks exist", () => {
    const text = "# Hello\n\nSome paragraph text.\n";
    assert.deepStrictEqual(findD2Blocks(text), []);
  });

  it("returns empty array for non-d2 fenced blocks", () => {
    const text = ["# Heading", "", "```javascript", "console.log('hi');", "```", ""].join(
      "\n",
    );
    assert.deepStrictEqual(findD2Blocks(text), []);
  });

  it("finds a single d2 block", () => {
    const text = ["# Diagram", "", "```d2", "a -> b", "```", ""].join("\n");

    const blocks = findD2Blocks(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].code, "a -> b");
    assert.strictEqual(blocks[0].startLine, 2); // 0-indexed line of ```d2
    assert.strictEqual(blocks[0].endLine, 4); // 0-indexed line of closing ```
  });

  it("finds multiple d2 blocks", () => {
    const text = [
      "# First",
      "",
      "```d2",
      "x -> y",
      "```",
      "",
      "# Second",
      "",
      "```d2",
      "a -> b",
      "b -> c",
      "```",
      "",
    ].join("\n");

    const blocks = findD2Blocks(text);
    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].code, "x -> y");
    assert.strictEqual(blocks[0].startLine, 2);
    assert.strictEqual(blocks[0].endLine, 4);
    assert.strictEqual(blocks[1].code, "a -> b\nb -> c");
    assert.strictEqual(blocks[1].startLine, 8);
    assert.strictEqual(blocks[1].endLine, 11);
  });

  it("handles d2 block with multiple lines of code", () => {
    const text = [
      "```d2",
      "server: {",
      "  shape: cloud",
      "}",
      "client -> server: request",
      "```",
    ].join("\n");

    const blocks = findD2Blocks(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(
      blocks[0].code,
      "server: {\n  shape: cloud\n}\nclient -> server: request",
    );
    assert.strictEqual(blocks[0].startLine, 0);
    assert.strictEqual(blocks[0].endLine, 5);
  });

  it("returns empty code for an empty d2 block", () => {
    const text = ["```d2", "```"].join("\n");

    const blocks = findD2Blocks(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].code, "");
    assert.strictEqual(blocks[0].startLine, 0);
    assert.strictEqual(blocks[0].endLine, 1);
  });

  it("ignores d2 blocks that are never closed", () => {
    const text = ["# Heading", "", "```d2", "a -> b"].join("\n");

    assert.deepStrictEqual(findD2Blocks(text), []);
  });

  it("does not match d2 as a substring of another language tag", () => {
    const text = ["```d2extra", "a -> b", "```"].join("\n");

    assert.deepStrictEqual(findD2Blocks(text), []);
  });

  it("handles mixed fenced blocks, only returning d2 ones", () => {
    const text = [
      "```python",
      "print('hi')",
      "```",
      "",
      "```d2",
      "a -> b",
      "```",
      "",
      "```typescript",
      "const x = 1;",
      "```",
    ].join("\n");

    const blocks = findD2Blocks(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].code, "a -> b");
    assert.strictEqual(blocks[0].startLine, 4);
    assert.strictEqual(blocks[0].endLine, 6);
  });

  it("handles indented d2 fence opening (should not match)", () => {
    const text = ["    ```d2", "    a -> b", "    ```"].join("\n");

    // Per CommonMark, up to 3 spaces of indentation is allowed for fenced code blocks
    // but 4 spaces means it's an indented code block, not a fenced one.
    // We follow a pragmatic approach: skip 4+ space indented fences.
    assert.deepStrictEqual(findD2Blocks(text), []);
  });
});
