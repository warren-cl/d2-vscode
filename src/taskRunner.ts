import * as path from "path";

import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range, Uri } from "vscode";
import { outputChannel } from "./extension";
import { d2Tasks } from "./tasks";
import { parseD2Errors } from "./d2ErrorParser";

// eslint-disable-next-line no-unused-vars
export type TaskRunnerCallback = (data: string, error: string) => void;
// eslint-disable-next-line no-unused-vars
export type TaskOutput = (text: string, flag?: boolean) => void;

/**
 * TaskRunner - Compiles D2 documents and reports errors via DiagnosticCollection.
 * Calls are synchronous — the callback fires before genTask() returns.
 */
export class TaskRunner {
  private diagnosticCollection: DiagnosticCollection | undefined;

  setDiagnosticCollection(dc: DiagnosticCollection): void {
    this.diagnosticCollection = dc;
  }

  public genTask(filename: string, text: string, callback: TaskRunnerCallback): void {
    const fileDir = path.parse(filename).dir;

    let collectedErrors = "";

    const data: string = d2Tasks.compile(
      text,
      fileDir,
      (msg) => {
        outputChannel.appendInfo(msg);
      },
      (err, flag) => {
        if (flag === true) {
          collectedErrors += err + "\n";
        }
      },
    );

    // Update diagnostics for this file
    if (this.diagnosticCollection) {
      const uri = Uri.file(filename);
      if (collectedErrors) {
        const parsed = parseD2Errors(collectedErrors);
        const diagnostics: Diagnostic[] = parsed.map((e) => {
          const range = new Range(e.line, e.column, e.line, e.column);
          const d = new Diagnostic(range, e.message, DiagnosticSeverity.Error);
          d.source = "d2";
          if (e.errorType) {
            d.code = e.errorType;
          }
          return d;
        });
        this.diagnosticCollection.set(uri, diagnostics);
      } else {
        this.diagnosticCollection.delete(uri);
      }
    }

    callback(data, collectedErrors);
  }
}
