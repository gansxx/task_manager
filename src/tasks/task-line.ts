import type { ParsedTaskLine, TaskPriority } from "../types";
import { getDatePart } from "../utils/date";

const TASK_LINE_REGEX = /^(\s*)-\s\[( |x|X)\]\s?(.*)$/;
const START_TOKEN_REGEX = /@start\(([^)]+)\)/;
const DONE_TOKEN_REGEX = /@done\(([^)]+)\)/;
const PRIORITY_TOKEN_REGEX = /\s*@priority\((none|low|medium|high|urgent)\)/i;
const COMMENT_TOKEN_REGEX = /\s*@comment\([^)]+\)/g;

export function parseTaskLine(line: string): ParsedTaskLine | null {
  const match = TASK_LINE_REGEX.exec(line);
  if (!match) {
    return null;
  }

  const [, indent, marker, body] = match;
  const startToken = START_TOKEN_REGEX.exec(body)?.[0];
  const doneToken = DONE_TOKEN_REGEX.exec(body)?.[0];
  const priority = normalizePriority(PRIORITY_TOKEN_REGEX.exec(body)?.[1]);

  return {
    indent,
    checked: marker.toLowerCase() === "x",
    body,
    startToken,
    doneToken,
    priority,
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

export function removeDoneToken(line: string): string {
  const parsed = parseTaskLine(line);
  if (!parsed || !parsed.doneToken) {
    return line;
  }

  const body = parsed.body.replace(DONE_TOKEN_REGEX, "").replace(/\s{2,}/g, " ").trim();
  return `${parsed.indent}- [ ] ${body}`.trimEnd();
}

export function setTaskPriority(line: string, priority: TaskPriority): string {
  const parsed = parseTaskLine(line);
  if (!parsed) {
    return line;
  }

  const bodyWithoutPriority = parsed.body
    .replace(PRIORITY_TOKEN_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const priorityToken = priority === "none" ? "" : ` @priority(${priority})`;
  const body = `${bodyWithoutPriority}${priorityToken}`.trim();
  const marker = parsed.checked ? "x" : " ";
  return `${parsed.indent}- [${marker}] ${body}`.trimEnd();
}

export function appendTaskComment(line: string, comment: string): string {
  return appendTaskCommentWithTimestamp(line, comment, null);
}

export function appendTaskCommentWithTimestamp(
  line: string,
  comment: string,
  timestamp: string | null,
): string {
  const parsed = parseTaskLine(line);
  const trimmedComment = comment.trim();
  if (!parsed || !trimmedComment) {
    return line;
  }

  const timestampToken = timestamp ? ` @comment(${timestamp})` : " @comment";
  return `${line}\n${parsed.indent}\t- ${trimmedComment}${timestampToken}`;
}

export function setTaskChecked(
  line: string,
  checked: boolean,
  doneToken?: string,
): string {
  const parsed = parseTaskLine(line);
  if (!parsed) {
    return line;
  }

  if (checked) {
    const checkedLine = `${parsed.indent}- [x] ${parsed.body}`.trimEnd();
    if (doneToken) {
      return appendDoneToken(checkedLine, doneToken);
    }
    return checkedLine;
  }

  const uncheckedLine = `${parsed.indent}- [ ] ${parsed.body}`.trimEnd();
  return removeDoneToken(uncheckedLine);
}

export function getTaskTokenDates(line: string): {
  start: string | null;
  done: string | null;
} {
  const parsed = parseTaskLine(line);
  if (!parsed) {
    return { start: null, done: null };
  }

  const start = START_TOKEN_REGEX.exec(parsed.body)?.[1] ?? null;
  const done = DONE_TOKEN_REGEX.exec(parsed.body)?.[1] ?? null;
  return { start, done };
}

export function stripMetadataTokens(value: string): string {
  return value
    .replace(/@(?:start|done|priority|archived)\([^)]+\)/g, "")
    .replace(/@from\("[^"]+"\)/g, "")
    .replace(COMMENT_TOKEN_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function getTaskReferenceDate(line: string): string | null {
  const parsed = parseTaskLine(line);
  if (!parsed) {
    return null;
  }

  const doneDate = DONE_TOKEN_REGEX.exec(parsed.body)?.[1];
  const normalizedDoneDate = doneDate ? getDatePart(doneDate) : null;
  if (normalizedDoneDate) {
    return normalizedDoneDate;
  }

  const startDate = START_TOKEN_REGEX.exec(parsed.body)?.[1];
  return startDate ? getDatePart(startDate) : null;
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

export function wasTaskReopened(
  previousLine: string,
  currentLine: string,
): boolean {
  const previousTask = parseTaskLine(previousLine);
  const currentTask = parseTaskLine(currentLine);

  return Boolean(
    previousTask &&
      currentTask &&
      previousTask.checked &&
      !currentTask.checked &&
      currentTask.doneToken,
  );
}

export function getCheckboxCursorOffset(line: string): number {
  const match = /^(\s*)-\s\[\s\]\s?/.exec(line);
  if (!match) {
    return 0;
  }

  return match[0].length;
}

function normalizePriority(value: string | undefined): TaskPriority {
  switch (value?.toLowerCase()) {
    case "low":
    case "medium":
    case "high":
    case "urgent":
      return value.toLowerCase() as TaskPriority;
    default:
      return "none";
  }
}
