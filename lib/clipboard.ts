// navigator.clipboard requires a secure context (https, or localhost) and is
// undefined on plain-http LAN addresses — e.g. a phone hitting the dev server
// during local testing. Fall back to the legacy textarea + execCommand trick
// so "copy" doesn't silently do nothing in that case. Must be called
// synchronously inside the click handler (the copy permission is tied to the
// user gesture on some mobile browsers).
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy method below
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
