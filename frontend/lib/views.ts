export const VIEWS = [
  { id: "profile", title: "My profile" },
  { id: "portfolio", title: "My portfolio" },
  { id: "replay", title: "Time machine" },
  { id: "ask", title: "Ask" },
  { id: "proof", title: "Proof" },
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
