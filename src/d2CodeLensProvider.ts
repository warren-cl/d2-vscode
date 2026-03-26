import { CodeLens, CodeLensProvider, Range, TextDocument } from "vscode";
import { findD2Blocks } from "./d2BlockFinder";

export class D2CodeLensProvider implements CodeLensProvider {
  provideCodeLenses(document: TextDocument): CodeLens[] {
    const text = document.getText();
    const blocks = findD2Blocks(text);

    return blocks.map((block) => {
      const range = new Range(block.startLine, 0, block.startLine, 0);
      return new CodeLens(range, {
        title: "$(preview) View D2 diagram",
        command: "D2.ViewDiagramFromMarkdown",
        arguments: [block.code, document.uri],
      });
    });
  }
}
