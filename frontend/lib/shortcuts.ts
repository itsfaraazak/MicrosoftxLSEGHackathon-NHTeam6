// One list drives both the key handlers' documentation and the "?" panel.
export const SHORTCUTS: { keys: string[]; label: string; scope: string }[] = [
  { keys: ["←", "→"], label: "Previous or next view", scope: "Anywhere" },
  { keys: ["1", "2", "3", "4"], label: "Jump to a view", scope: "Anywhere" },
];

// Shortcuts never fire while someone is typing or using a modifier chord.
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
