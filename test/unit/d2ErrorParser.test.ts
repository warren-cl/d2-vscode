import { strict as assert } from "assert";
import { parseD2Errors } from "../../src/d2ErrorParser";

describe("parseD2Errors", () => {
  it("returns empty array for empty string", () => {
    assert.deepStrictEqual(parseD2Errors(""), []);
  });

  it("returns empty array for non-error output", () => {
    assert.deepStrictEqual(parseD2Errors("some random text\nanother line"), []);
  });

  it("parses a single error line (converts to 0-based)", () => {
    const stderr = "err: Syntax Error : 5:10: unexpected token";
    const errors = parseD2Errors(stderr);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].line, 4);
    assert.strictEqual(errors[0].column, 9);
    assert.strictEqual(errors[0].message, "unexpected token");
  });

  it("parses error type correctly", () => {
    const stderr = "err:Compile Error: 1:1: bad input";
    const errors = parseD2Errors(stderr);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].errorType, "Compile Error");
  });

  it("parses multiple error lines", () => {
    const stderr = [
      "err: Syntax Error : 3:5: missing semicolon",
      "err: Syntax Error : 7:1: unexpected end",
    ].join("\n");
    const errors = parseD2Errors(stderr);
    assert.strictEqual(errors.length, 2);
    assert.strictEqual(errors[0].line, 2);
    assert.strictEqual(errors[0].column, 4);
    assert.strictEqual(errors[1].line, 6);
    assert.strictEqual(errors[1].column, 0);
  });

  it("skips blank lines and non-error lines mixed in", () => {
    const stderr = [
      "",
      "some info line",
      "err: Syntax Error : 2:4: problem here",
      "",
      "another info line",
    ].join("\n");
    const errors = parseD2Errors(stderr);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].line, 1);
    assert.strictEqual(errors[0].message, "problem here");
  });

  it("handles error with no spaces around colons", () => {
    const stderr = "err:ErrorType:10:20:some message";
    const errors = parseD2Errors(stderr);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].line, 9);
    assert.strictEqual(errors[0].column, 19);
    assert.strictEqual(errors[0].message, "some message");
  });

  it("preserves trailing message content with colons", () => {
    const stderr = "err: Parse Error : 1:1: expected: shape, got: label";
    const errors = parseD2Errors(stderr);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].message, "expected: shape, got: label");
  });
});
