export interface D2Error {
  line: number;
  column: number;
  errorType: string;
  message: string;
}

const ERROR_PATTERN = /^err:\s*([A-Za-z\s]*?)\s*:\s*(\d+):(\d+):\s*(.*)$/;

export function parseD2Errors(stderr: string): D2Error[] {
  if (!stderr) {
    return [];
  }

  const errors: D2Error[] = [];
  for (const line of stderr.split("\n")) {
    const match = ERROR_PATTERN.exec(line);
    if (match) {
      errors.push({
        errorType: match[1],
        line: parseInt(match[2], 10) - 1,
        column: parseInt(match[3], 10) - 1,
        message: match[4],
      });
    }
  }
  return errors;
}
