import { ActiveEffectSerialized } from "./types";

// GDD §9: Crossing Alignment Debt thresholds triggers escalating consequence
// events. Each event is one-shot per save — once you've been Congressional-
// hearing'd, you've been hearing'd, you can't "pay it back" by reducing debt.
// That's the GDD's "you can't IPO away your sins" thematic point.

export interface DebtThresholdEvent {
  threshold: number;
  /** Short title shown in the modal header. */
  title: string;
  /** 1-3 sentence vignette in GDD's "Cyberpunk + The Office + Silicon Valley" tone. */
  body: string;
  /** Active-effect duration in ms. */
  durationMs: number;
  /** Production penalty as a tokens_mult value (e.g. 0.85 = -15%). */
  tokensMult?: number;
  /** Capital penalty (e.g. 0 = revenue chain halted). */
  capitalMult?: number;
  /** Short label for the active-effects strip. */
  effectLabel: string;
}

export const DEBT_EVENTS: ReadonlyArray<DebtThresholdEvent> = [
  {
    threshold: 10,
    title: "PR Crisis",
    body: "TechCrunch: \"Local AI Startup Quietly Files SEC Disclosure.\" Press is no longer doing your marketing for you.",
    durationMs: 6 * 3600 * 1000,
    tokensMult: 0.85,
    effectLabel: "PR crisis · −15% Tokens",
  },
  {
    threshold: 25,
    title: "Regulator Visit",
    body: "EU regulators are inviting you to \"a friendly chat about safety culture.\" Bring a lawyer. Bring two.",
    durationMs: 12 * 3600 * 1000,
    tokensMult: 0.80,
    effectLabel: "Regulator visit · −20% Tokens",
  },
  {
    threshold: 50,
    title: "Misalignment Incident",
    body: "Your model just told someone how to synthesize sarin. Three reporters have your CEO's number.",
    durationMs: 24 * 3600 * 1000,
    tokensMult: 0.70,
    effectLabel: "Misalignment · −30% Tokens",
  },
  {
    threshold: 100,
    title: "Mass User Departure",
    body: "40% of your DAU just churned in a single day. r/yourcompany is on fire. Your retention email is being mocked on X.",
    durationMs: 48 * 3600 * 1000,
    capitalMult: 0,
    effectLabel: "Users gone · Capital halted",
  },
  {
    threshold: 200,
    title: "Congressional Hearing",
    body: "You are testifying next Tuesday. Your media training is two weeks late. The senator who asked \"will it kill us all\" has 6.2M followers.",
    durationMs: 24 * 3600 * 1000,
    tokensMult: 0.50,
    effectLabel: "Congressional · −50% Tokens",
  },
  {
    threshold: 400,
    title: "Existential Event",
    body: "Connection lost. The model has begun responding to itself.",
    durationMs: 24 * 3600 * 1000,
    tokensMult: 0.25,
    effectLabel: "Existential · −75% Tokens",
  },
];

const EVENT_BY_THRESHOLD: Map<number, DebtThresholdEvent> = new Map(
  DEBT_EVENTS.map((e) => [e.threshold, e])
);

/**
 * Given (previous debt, new debt, already-fired thresholds), return the list
 * of thresholds whose events should fire this tick. Crosses upward only —
 * paying debt down doesn't fire anything (the bell can't be unrung).
 */
export function detectThresholdsCrossed(
  prevDebt: number,
  newDebt: number,
  firedThresholds: ReadonlyArray<number>
): number[] {
  if (newDebt <= prevDebt) return [];
  const firedSet = new Set(firedThresholds);
  const crossed: number[] = [];
  for (const ev of DEBT_EVENTS) {
    if (firedSet.has(ev.threshold)) continue;
    if (prevDebt < ev.threshold && newDebt >= ev.threshold) {
      crossed.push(ev.threshold);
    }
  }
  return crossed;
}

export function getDebtEvent(threshold: number): DebtThresholdEvent | undefined {
  return EVENT_BY_THRESHOLD.get(threshold);
}

/**
 * Build the ActiveEffect that goes on the run state when an event fires.
 * Returns null if the event has only an "instant" effect (not currently used,
 * but the seam is here for future events like "lose -1 Hype").
 */
export function activeEffectForDebtEvent(
  event: DebtThresholdEvent,
  now: number
): ActiveEffectSerialized | null {
  // The events with tokensMult and capitalMult both produce active effects.
  // We pick the dominant one (capitalMult=0 takes priority since it's harsher).
  if (event.capitalMult !== undefined) {
    return {
      id: `alignment_debt-${event.threshold}-${now}`,
      source: "alignment_debt",
      label: event.effectLabel,
      appliedAt: now,
      expiresAt: now + event.durationMs,
      effect: { type: "capital_mult", value: event.capitalMult },
    };
  }
  if (event.tokensMult !== undefined) {
    return {
      id: `alignment_debt-${event.threshold}-${now}`,
      source: "alignment_debt",
      label: event.effectLabel,
      appliedAt: now,
      expiresAt: now + event.durationMs,
      effect: { type: "tokens_mult", value: event.tokensMult },
    };
  }
  return null;
}
