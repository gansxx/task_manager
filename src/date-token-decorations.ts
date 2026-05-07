import type { Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { Plugin } from "obsidian";

const TOKEN_REGEX = /@(start|done)\([^)]+\)/g;
const TOKEN_CLASS = "task-manager-date-token";

const matchDecorator = new MatchDecorator({
  regexp: TOKEN_REGEX,
  decoration: (match) =>
    Decoration.mark({
      class: `${TOKEN_CLASS} ${getTokenVariantClass(match[1])}`,
    }),
});

class TaskDateTokenPluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = matchDecorator.createDeco(view);
  }

  update(update: ViewUpdate): void {
    this.decorations = matchDecorator.updateDeco(update, this.decorations);
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
  });

  plugin.registerEditorExtension(createEditorExtension());
}

function createEditorExtension(): Extension {
  return ViewPlugin.fromClass(TaskDateTokenPluginValue, {
    decorations: (pluginValue) => pluginValue.decorations,
  });
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
    tokenEl.className = `${TOKEN_CLASS} ${getTokenVariantClass(match[1])}`;
    tokenEl.textContent = match[0];
    fragment.append(tokenEl);

    index = start + match[0].length;
  }

  if (index < text.length) {
    fragment.append(text.slice(index));
  }

  textNode.replaceWith(fragment);
}

function getTokenVariantClass(tokenType: string): string {
  return tokenType === "done" ? "is-done" : "is-start";
}
