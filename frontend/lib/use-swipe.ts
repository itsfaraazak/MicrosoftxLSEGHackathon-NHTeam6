"use client";

import { useEffect, useRef } from "react";

/**
 * Integration note: the element this hook listens on (or its swipeable
 * container) should have `touch-action: pan-y` in CSS so the browser still
 * allows native vertical scrolling while this hook tracks horizontal
 * pointer gestures for left/right swipe classification.
 */

export type SwipeDirection = "left" | "right" | null;

export interface ClassifySwipeOptions {
  threshold?: number;
  maxAngleDeg?: number;
}

const DEFAULT_THRESHOLD = 60;
const DEFAULT_MAX_ANGLE_DEG = 30;

/**
 * Pure classifier: given the total horizontal (dx) and vertical (dy) delta
 * of a pointer/touch gesture (end - start), returns "left", "right", or
 * null. No side effects, no DOM access.
 */
export function classifySwipe(
  dx: number,
  dy: number,
  opts?: ClassifySwipeOptions,
): SwipeDirection {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;
  const maxAngleDeg = opts?.maxAngleDeg ?? DEFAULT_MAX_ANGLE_DEG;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx <= threshold) {
    return null;
  }

  const angleDeg = (Math.atan2(absDy, absDx) * 180) / Math.PI;
  if (angleDeg > maxAngleDeg) {
    return null;
  }

  return dx < 0 ? "left" : "right";
}

/**
 * Selectors for elements (or ancestors) whose gestures should NOT be
 * treated as app-level swipes: form controls, code blocks, chart
 * containers, dialog/sheet overlays, and anything explicitly opted out via
 * data attributes. Exported so callers can extend it.
 */
export const IGNORED_SWIPE_SELECTORS: string[] = [
  "input",
  "textarea",
  "select",
  "[contenteditable]",
  "[contenteditable='true']",
  "pre",
  "code",
  ".recharts-wrapper",
  ".recharts-responsive-container",
  "[role='dialog']",
  "[data-radix-scroll-area-viewport]",
  "[data-slot='sheet-content']",
  "[data-slot='sheet-overlay']",
  "[data-no-swipe]",
  "[data-horizontal-scroll]",
];

export function isIgnoredSwipeTarget(el: Element | null): boolean {
  if (!el) return false;
  return el.closest(IGNORED_SWIPE_SELECTORS.join(",")) !== null;
}

export interface UseSwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export interface UseSwipeOptions extends ClassifySwipeOptions {
  disabled?: boolean;
}

/**
 * Attaches pointer listeners on window to detect horizontal swipe gestures
 * and invoke the matching handler. SSR-safe (no-ops when window is
 * undefined). Reduced-motion users can still navigate via swipe; this hook
 * applies no visual/animated side effects of its own.
 */
export function useSwipe(
  handlers: UseSwipeHandlers,
  opts?: UseSwipeOptions,
): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const disabled = opts?.disabled ?? false;
  const threshold = opts?.threshold;
  const maxAngleDeg = opts?.maxAngleDeg;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (disabled) return;

    let start: { x: number; y: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (disabled) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.isPrimary === false) return;
      if (isIgnoredSwipeTarget(event.target as Element | null)) return;

      start = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;

      const direction = classifySwipe(dx, dy, { threshold, maxAngleDeg });
      if (direction === "left") {
        handlersRef.current.onSwipeLeft?.();
      } else if (direction === "right") {
        handlersRef.current.onSwipeRight?.();
      }
    };

    const onPointerCancel = () => {
      start = null;
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [disabled, threshold, maxAngleDeg]);
}
