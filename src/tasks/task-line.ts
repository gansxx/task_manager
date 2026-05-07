import type { ParsedTaskLine } from "../types";

const TASK_LINE_REGEX = /^(\s*)-\s\[( |x|X)\]\s?(.*)$/;
const START_TOKEN_REGEX = /@start\(([^)]+)\)/;
const DONE_TOKEN_REGEX = /@done\(([^)]+)\)/;
const DATE_STAMP_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseTaskLine(line: string): ParsedTaskLine | null {
  const match = TASK_LINE_REGEX.exec(line);
  if (!match) {
    return null;
  }

  const [, indent, marker, body] = match;
  const startToken = START_TOKEN_REGEX.exec(body)?.[0];
  const doneToken = DONE_TOKEN_REGEX.exec(body)?.[0];

  return {
    indent,
    checked: marker.toLowerCase() === "x",
    body,
    startToken,
    doneToken,
  };
}

export function isEmptyUncheckedTask(line: string): boolean {
  return /^\s*-\s\[\s\]\s*$/.test(line);
}

export function createStartLine(line: string, startToken: string): string {
  const parsed = parseTaskLine(line);
  if (!parsed || parsed.startToken) {
    return line;
  }

  return `${parsed.indent}- [ ] ${startToken}`;
}

export function appendDoneToken(line: string, doneToken: string): string {
  const parsed = parseTaskLine(line);
  if (!parsed || parsed.doneToken) {
    return line;
  }

  const suffix = parsed.body.trim().length > 0 ? " " : "";
  return `${parsed.indent}- [x] ${parsed.body}${suffix}${doneToken}`.trimEnd();
}

export function getTaskReferenceDate(line: string): string | null {
  const parsed = parseTaskLine(line);
  if (!parsed) {
    return null;
  }

  const doneDate = DONE_TOKEN_REGEX.exec(parsed.body)?.[1];
  if (doneDate && DATE_STAMP_REGEX.test(doneDate)) {
    return doneDate;
  }

  const startDate = START_TOKEN_REGEX.exec(parsed.body)?.[1];
  if (startDate && DATE_STAMP_REGEX.test(startDate)) {
    return startDate;
  }

  return null;
}

export function isTaskArchivable(line: string): boolean {
  const parsed = parseTaskLine(line);
  if (!parsed) {
    return false;
  }

  return parsed.checked;
}

export function wasTaskCompleted(
  previousLine: string,
  currentLine: string,
): boolean {
  const previousTask = parseTaskLine(previousLine);
  const currentTask = parseTaskLine(currentLine);

  return Boolean(
    previousTask &&
      currentTask &&
      !previousTask.checked &&
      currentTask.checked,
  );
}

export function getCheckboxCursorOffset(line: string): number {
  const match = /^(\s*)-\s\[\s\]\s?/.exec(line);
  if (!match) {
    return 0;
  }

  return match[0].length;
}
