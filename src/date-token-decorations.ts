import type { Extension } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { Plugin } from "obsidian";
import { parseTaskLine } from "./tasks/task-line";

const TOKEN_REGEX = /@(?:(start|done|archived)\([^)]+\)|(from)\("[^"]+"\)|(priority)\((none|low|medium|high|urgent)\))/gi;
const TOKEN_CLASS = "task-manager-date-token";

class TaskDateTokenPluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = buildDecorations(update.view);
    }
  }
}

export function registerDateTokenDecorations(plugin: Plugin): void {
  plugin.registerMarkdownPostProcessor((el) => {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!(node instanceof Text)) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }

        if (
          parent.closest("code, pre, .task-manager-date-token") ||
          !TOKEN_REGEX.test(node.textContent ?? "")
        ) {
          TOKEN_REGEX.lastIndex = 0;
          return NodeFilter.FILTER_REJECT;
        }

        TOKEN_REGEX.lastIndex = 0;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let currentNode = walker.nextNode();
    while (currentNode instanceof Text) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    for (const textNode of textNodes) {
      replaceTextNodeTokens(textNode);
    }

    decorateRenderedTaskPriorities(el);
  });

  plugin.registerEditorExtension(createEditorExtension());
}

function createEditorExtension(): Extension {
  return ViewPlugin.define((view) => new TaskDateTokenPluginValue(view), {
    decorations: (pluginValue) => pluginValue.decorations,
  });
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let position = from;
    while (position <= to) {
      const line = view.state.doc.lineAt(position);
      const parsedTask = parseTaskLine(line.text);
      if (parsedTask?.priority && parsedTask.priority !== "none") {
        builder.add(
          line.from,
          line.from,
          Decoration.line({
            class: `task-manager-priority-line is-priority-${parsedTask.priority}`,
          }),
        );
      }

      TOKEN_REGEX.lastIndex = 0;
      for (const match of line.text.matchAll(TOKEN_REGEX)) {
        const tokenStart = line.from + (match.index ?? 0);
        builder.add(
          tokenStart,
          tokenStart + match[0].length,
          Decoration.mark({ class: `${TOKEN_CLASS} ${getTokenVariantClass(match)}` }),
        );
      }

      position = line.to + 1;
    }
  }

  return builder.finish();
}

function replaceTextNodeTokens(textNode: Text): void {
  const text = textNode.textContent ?? "";
  TOKEN_REGEX.lastIndex = 0;

  const matches = [...text.matchAll(TOKEN_REGEX)];
  if (matches.length === 0) {
    return;
  }

  const fragment = document.createDocumentFragment();
  let index = 0;

  for (const match of matches) {
    const start = match.index ?? 0;
    if (start > index) {
      fragment.append(text.slice(index, start));
    }

    const tokenEl = document.createElement("span");
    tokenEl.className = `${TOKEN_CLASS} ${getTokenVariantClass(match)}`;
    tokenEl.textContent = match[0];
    fragment.append(tokenEl);

    index = start + match[0].length;
  }

  if (index < text.length) {
    fragment.append(text.slice(index));
  }

  textNode.replaceWith(fragment);
}

function decorateRenderedTaskPriorities(el: HTMLElement): void {
  for (const taskEl of el.querySelectorAll<HTMLElement>("li.task-list-item")) {
    const parsedTask = parseTaskLine(`- [ ] ${taskEl.textContent ?? ""}`);
    if (!parsedTask || parsedTask.priority === "none") {
      continue;
    }

    taskEl.addClass("task-manager-priority-item");
    taskEl.addClass(`is-priority-${parsedTask.priority}`);
  }
}

function getTokenVariantClass(match: RegExpMatchArray | RegExpExecArray): string {
  const tokenType = match[1] ?? match[2] ?? match[3] ?? "start";

  switch (tokenType.toLowerCase()) {
    case "done":
      return "is-done";
    case "from":
      return "is-from";
    case "archived":
      return "is-archived";
    case "priority":
      return `is-priority is-priority-${match[4]?.toLowerCase() ?? "none"}`;
    default:
      return "is-start";
  }
}
