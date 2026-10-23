// `short` is the label for the phone tab bar.
export const VIEWS = [
  { id: "profile", title: "My profile", short: "Profile" },
  { id: "portfolio", title: "My portfolio", short: "Plan" },
  { id: "replay", title: "Time machine", short: "Replay" },
  { id: "ask", title: "Ask", short: "Ask" },
  { id: "proof", title: "Proof", short: "Proof" },
] as const;

export type ViewId = (typeof VIEWS)[number]["id"];

export function viewIndex(id: string | null): number {
  const i = VIEWS.findIndex((v) => v.id === id);
  return i === -1 ? 0 : i;
}

export const panelId = (id: ViewId) => `panel-${id}`;
export const tabId = (id: ViewId) => `tab-${id}`;

// Next's useSearchParams follows native history updates, so view changes need no server round trip.
export function goToView(id: ViewId) {
  window.history.replaceState(null, "", `?view=${id}`);
}
