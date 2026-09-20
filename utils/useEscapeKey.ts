import { useEffect } from "react";

// Close a modal/dialog with the Escape key. `active` = the modal is open.
// Pass a stable-enough handler (an inline arrow is fine — the listener just
// re-subscribes on re-render, which is cheap).
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onEscape(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}

// Full keyboard support for a modal form: Escape cancels/closes, Enter submits.
// Enter is ignored while focus is in a textarea, a <select>, a button, or a
// contenteditable — so those keep their native Enter behaviour (newline, open,
// click). Use this for create/edit modals that are NOT wrapped in a native
// <form> (a real <form> already submits on Enter, so use useEscapeKey there to
// avoid a double submit).
export function useModalKeys(active: boolean, opts: { onClose: () => void; onSubmit?: () => void }) {
  const { onClose, onSubmit } = opts;
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "Enter" && onSubmit && !e.shiftKey) {
        const el = document.activeElement as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
        if (el?.getAttribute?.("contenteditable") === "true") return;
        if (el?.getAttribute?.("role") === "button") return;
        e.preventDefault();
        onSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose, onSubmit]);
}
