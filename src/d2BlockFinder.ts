export interface D2BlockInfo {
  code: string;
  startLine: number;
  endLine: number;
}

export function findD2Blocks(text: string): D2BlockInfo[] {
  const lines = text.split("\n");
  const blocks: D2BlockInfo[] = [];
  let i = 0;

  while (i < lines.length) {
    // Match opening fence: up to 3 spaces indent, 3+ backticks, "d2", optional whitespace, nothing else
    if (/^ {0,3}```d2\s*$/.test(lines[i])) {
      const startLine = i;
      const codeLines: string[] = [];
      i++;

      // Scan for closing fence
      let closed = false;
      while (i < lines.length) {
        if (/^ {0,3}```\s*$/.test(lines[i])) {
          blocks.push({
            code: codeLines.join("\n"),
            startLine,
            endLine: i,
          });
          closed = true;
          i++;
          break;
        }
        codeLines.push(lines[i]);
        i++;
      }

      // Unclosed block — skip it entirely
      if (!closed) {
        break;
      }
    } else {
      i++;
    }
  }

  return blocks;
}
