export type AudioEventName =
  | "card-flip"
  | "score-tick"
  | "bluff-called"
  | "mult-fire"
  | "button-hover";

export function dispatchAudioEvent(
  name: AudioEventName,
  detail: Record<string, unknown> = {}
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(name, { detail }));
}
