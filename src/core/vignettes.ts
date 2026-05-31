// Narrative spine — GDD §5 "Vignettes" + Appendix E.
// ~50 vignettes at v1.0; this file ships 15 of them (V01–V15 from the sample
// inventory) so the inbox has something to populate immediately. Each is a
// 1–4-screen fake-medium piece (Slack DM / board memo / fake tweet / leaked
// email / fake news / podcast / system message) that unlocks at a milestone
// and PERSISTS across prestige (§5, key thematic choice).
//
// This module is pure data + pure predicates. No store, no UI, no side
// effects — the trigger loop and the inbox screen wire it up separately.

import { D, Decimal } from "./decimal";
import { ActiveEffectSerialized } from "./types";

// ─── Medium types ────────────────────────────────────────────────────────
export type VignetteMedium =
  | "slack"
  | "board_memo"
  | "fake_tweet"
  | "leaked_email"
  | "fake_news"
  | "podcast"
  | "system";

// ─── Unlock conditions ───────────────────────────────────────────────────
// Discriminated union of predicates that the trigger loop can evaluate
// every tick. Keep the set small — new conditions cost code in evalCondition,
// and the GDD's sample inventory covers most of the design intent here.
//
// Fields we intentionally don't yet support (sample inventory uses them, but
// we have no metric for them today):
//   - "10K users milestone"     → no user count; we proxy with tokens_at_least 10000
//   - "Random after Nh playtime"→ no playtime tracking; left as TODO
//   - pure random fire           → left as TODO (would need RNG + per-tick budget)
// These show up below as TODO comments on the affected vignettes.
export type UnlockCondition =
  // Any non-starter producer owned (i.e. the player has clicked Buy at least
  // once in any chain). starterCount tells us "what counts as starter."
  | { kind: "first_hire" }
  // Total producers owned across all chains is at least n (counts starters).
  | { kind: "total_producers_owned"; n: number }
  // Tokens (run-current) reach at least n. Used for "10K users" stand-in.
  | { kind: "tokens_at_least"; n: number }
  // Player has reached funding round of index roundIdx or higher.
  | { kind: "reach_round"; roundIdx: number }
  // Player is IN round roundIdx and has progressed past pct (0..1) of its threshold.
  | { kind: "approach_round"; roundIdx: number; pct: number }
  // First debt-threshold event has fired in this save (any persisted threshold).
  | { kind: "first_debt_event" }
  // A specific debt threshold has fired (e.g. 200 for Congressional Hearing).
  | { kind: "debt_threshold"; level: number }
  // Total prestiges (closed funding rounds) is at least n.
  | { kind: "prestige_count"; n: number };

// ─── Vignette shape ──────────────────────────────────────────────────────
// Slack DMs in Beat 3 (§4) carry reply choices that modify a stat for 1h.
// The replies + replyEffects arrays are index-aligned: replyEffects[i] fires
// when the player picks replies[i]. If a Slack vignette omits replyEffects
// (or the array is shorter than replies), the reply is flavor-only.
export interface VignetteReplyEffect {
  // Player-facing description shown in the BUFFS chip / Active effects strip.
  // GDD §14 calls these "+15% Hype for 1h" style — short, legible.
  label: string;
  // 1h default per GDD §4 Beat 3 ("Each modifies a stat for the next hour").
  // Cosmetic-only effects can pass 0 to opt out of the timer entirely.
  durationSec?: number;
  // Discriminated effect payload — same shape used by training runs and
  // alignment-debt events, so the aggregator in effects.ts already handles
  // these without changes.
  effect: ActiveEffectSerialized["effect"];
}

export interface Vignette {
  id: string;                        // stable slug used in save state
  name: string;                      // working title from Appendix E
  medium: VignetteMedium;
  sender: string;                    // "danny.t" / "YC · Series A Memo" / "@levelsio_clone"
  subject?: string;                  // board memos + emails get a subject line
  body: string;                      // 1–4 short paragraphs; can use \n\n
  replies?: string[];                // Slack DMs offer 2–3 reply options
  // Optional, index-aligned with `replies`. Picking replies[i] applies
  // replyEffects[i] to run.activeEffects for ~1h. See store.resolveVignette.
  replyEffects?: VignetteReplyEffect[];
  tone: string;                      // freeform tag for writers: "Cozy intro", "Cosmic dread"
  unlock: UnlockCondition;
}

// ─── Eval context ────────────────────────────────────────────────────────
// What the trigger loop hands in. Kept minimal — the data layer doesn't care
// about chains, allocation, research nodes, etc.
export interface UnlockContext {
  fundingRoundIdx: number;
  totalPrestiges: number;
  tokens: Decimal;
  // Used by the "approach_round" predicate to compare against round threshold.
  // The trigger layer reads this from `getRound(idx).tokenThresholdLog10`.
  nextRoundThreshold: Decimal;
  totalProducersOwned: number;       // sum of all producers, all chains, including starters
  alignmentDebt: Decimal;
  firedDebtThresholds: number[];     // PersistentState.firedDebtThresholds
}

// Evaluate one condition against a context snapshot. Pure.
export function isConditionMet(cond: UnlockCondition, ctx: UnlockContext): boolean {
  switch (cond.kind) {
    case "first_hire":
      // "Starter" floor in math.ts is intern=1, h100=3, common_crawl=3, office_grid=3 = 10 producers.
      // First hire = the player bought anything beyond that floor.
      return ctx.totalProducersOwned > STARTER_TOTAL;
    case "total_producers_owned":
      return ctx.totalProducersOwned >= cond.n;
    case "tokens_at_least":
      return ctx.tokens.gte(cond.n);
    case "reach_round":
      return ctx.fundingRoundIdx >= cond.roundIdx;
    case "approach_round":
      if (ctx.fundingRoundIdx !== cond.roundIdx) return false;
      if (ctx.nextRoundThreshold.lte(0)) return false;
      const ratio = ctx.tokens.div(ctx.nextRoundThreshold).toNumber();
      return ratio >= cond.pct;
    case "first_debt_event":
      return ctx.firedDebtThresholds.length > 0;
    case "debt_threshold":
      return ctx.firedDebtThresholds.includes(cond.level);
    case "prestige_count":
      return ctx.totalPrestiges >= cond.n;
  }
}

// GDD §4 "first producer pre-bought" + math.ts FLOORS. Exposed so the
// trigger layer can reason about the same baseline without duplicating it.
export const STARTER_TOTAL = 10; // intern(1) + h100(3) + common_crawl(3) + office_grid(3)

// ─── Vignette inventory (V01–V15 from Appendix E) ────────────────────────
// IDs match the save schema example in §16 ("welcome", "series_a_deck", …).
// Copy is written to match the GDD tone bible: "Cyberpunk 2077 meets The
// Office meets Silicon Valley HBO — not nihilistic, not preachy, recognizably
// funny with teeth." (§5)
export const VIGNETTES: Vignette[] = [
  {
    id: "welcome",
    name: "Welcome to the company",
    medium: "slack",
    sender: "danny.t",
    body: "welcome to the company. snacks are in the kitchen.\n\nwifi password is on the whiteboard. the whiteboard is wherever someone left it.",
    replies: [":wave:", "🙏 thx danny", "what's the wifi password"],
    // Cozy intro DM — small, friendly buffs. Each route is a vibe, not a tradeoff.
    replyEffects: [
      { label: "+5% Hype",    effect: { type: "hype_mult",    value: 1.05 } },
      { label: "+5% RP",      effect: { type: "rp_mult",      value: 1.05 } },
      { label: "+5% Capital", effect: { type: "capital_mult", value: 1.05 } },
    ],
    tone: "Cozy intro",
    unlock: { kind: "first_hire" },
  },
  {
    id: "re_slack_reaction",
    name: "Re: Slack reaction emoji",
    medium: "slack",
    sender: "danny.t",
    body: "should we standardize on :ship: vs :rocket: for launch announcements?\n\ni've seen both in the last week and it's giving me anxiety.",
    replies: [":ship:", ":rocket:", ":this:"],
    // Three vibes, three departments: sales / marketing / meta-aware R&D.
    replyEffects: [
      { label: "+10% Capital · ship culture",  effect: { type: "capital_mult", value: 1.10 } },
      { label: "+10% Hype · launch vibe",      effect: { type: "hype_mult",    value: 1.10 } },
      { label: "+10% RP · meta-aware",         effect: { type: "rp_mult",      value: 1.10 } },
    ],
    tone: "Comedy",
    unlock: { kind: "total_producers_owned", n: 20 }, // ~10 hires past starter
  },
  {
    id: "series_a_deck",
    name: "Series A Deck — Vision 2030",
    medium: "board_memo",
    sender: "Vision 2030 working group",
    subject: "Series A Deck — Vision 2030: AGI by Q4",
    body: "Confidential — for board eyes only.\n\nOur Series A narrative rests on three claims: (1) we are the only team capable of reaching AGI by Q4; (2) every other team is 18 months behind; (3) capital is the only remaining input. Please review and confirm before Thursday's investor call.\n\nWe are not hedging on the Q4 claim. Marketing has already drafted the press release.",
    tone: "Aspirational satire",
    unlock: { kind: "reach_round", roundIdx: 1 },
  },
  {
    id: "10k_mau_tweet",
    name: "10K MAU on no marketing",
    medium: "fake_tweet",
    sender: "@levelsio_clone",
    // TODO: real "10K users" condition once we track user count; tokens_at_least
    // is a proxy that fires roughly when an early founder would notice traction.
    body: "just hit 10k MAU on my AI app, no marketing, just based decisions ⚡\n\n0 → 10k in 3 weeks. building in public is undefeated.",
    tone: "Founder-bro humor",
    unlock: { kind: "tokens_at_least", n: 10_000 },
  },
  {
    id: "the_reorg",
    name: "The Reorg",
    medium: "board_memo",
    sender: "People Ops",
    subject: "All-hands: organizational realignment",
    // TODO: design says "random after 4h playtime"; proxy with reaching Series B.
    // Re-evaluate once we track total playtime.
    body: "Effective immediately, we are flattening the org to better serve customers.\n\nNo headcount will change. No reporting lines will change. Your title may change. Your laptop may change. Please update Slack profiles by EOD.\n\nThis is not a layoff.",
    tone: "Corporate dread",
    unlock: { kind: "reach_round", roundIdx: 2 },
  },
  {
    id: "re_1on1_cancelled",
    name: "Re: 1:1 cancelled",
    medium: "slack",
    sender: "sara.eng",
    body: "hey sorry — manager cancelled our 1:1 again. fourth time this month. they said they're \"swamped with strategy work.\"\n\ndo you think they hate me or hate their job. asking for me.",
    replies: ["both, probably", "neither, you're paranoid", "this is why we have therapists"],
    // First reply has a real tradeoff: sympathy is safer (slower debt accrual)
    // because the team trusts you. The other two are commercial / comedic vibes.
    replyEffects: [
      { label: "Debt accrual ×0.75 · sympathetic",  effect: { type: "debt_accrual_mult", value: 0.75 } },
      { label: "+15% Capital · efficient",          effect: { type: "capital_mult",      value: 1.15 } },
      { label: "+10% Hype · relatable",             effect: { type: "hype_mult",         value: 1.10 } },
    ],
    tone: "Mild absurdism",
    // TODO: should be a true random fire after some playtime; proxy with producer count.
    unlock: { kind: "total_producers_owned", n: 30 },
  },
  {
    id: "techcrunch_sec_disclosure",
    name: "TechCrunch — Quietly Files SEC Disclosure",
    medium: "fake_news",
    sender: "TechCrunch",
    subject: "Local AI Startup Quietly Files Regulatory Disclosure",
    body: "A prominent AI startup, which declined to be named for this story, filed a regulatory disclosure with the SEC on Friday afternoon — a time slot widely understood to be when companies bury news they hope no one reads.\n\nThe disclosure, totaling 84 pages, references \"emergent capability drift\" and \"unanticipated optimization pressure\" without specifying what either phrase means in the context of the company's flagship model.\n\nA spokesperson said the company \"remains fully aligned with all relevant frameworks.\"",
    tone: "Concerning",
    unlock: { kind: "first_debt_event" },
  },
  {
    id: "investor_update_dominant",
    name: "Investor update — 'dominant'",
    medium: "leaked_email",
    sender: "founder@[redacted].com",
    subject: "Q3 Investor Update — Numbers Up And To The Right",
    body: "Friends,\n\nAnother strong quarter. We are now dominant in every category we measure ourselves against. We measure ourselves against five categories. We are dominant in those.\n\nKey metrics: ARR up. NPS up. Engagement up. Burn up — but in a good way that suggests confidence in the vision. Headcount up. Office space up. Coffee consumption up.\n\nLet me know if you'd like to participate in the upcoming round. Allocation is limited.\n\n— [redacted]",
    tone: "Self-parody",
    unlock: { kind: "reach_round", roundIdx: 3 },
  },
  {
    id: "town_hall_transcript",
    name: "Town hall transcript",
    medium: "slack",
    sender: "all-hands · pinned",
    body: "[CEO opens with a slide titled \"Why We Win.\"]\n\nThe slide is the company logo. No bullet points. After 14 seconds of silence the CEO says \"any questions.\"\n\n[No questions.]\n\nThe town hall ends. The recording is shared in #announcements with the subject line \"important context for the next chapter.\"",
    tone: "Increasingly hollow",
    unlock: { kind: "reach_round", roundIdx: 4 },
  },
  {
    id: "re_lockup_period",
    name: "Re: Lockup Period",
    medium: "leaked_email",
    sender: "legal@[redacted].com",
    subject: "Re: All Hands — Lockup Period & You",
    body: "Team,\n\nAhead of the upcoming liquidity event, please review the attached document on the 180-day lockup period and what it means for you personally.\n\nKey points: you cannot sell. You cannot transfer. You cannot pledge as collateral. You may attend the celebration dinner. The celebration dinner is at the same restaurant as last quarter's all-hands. Please RSVP by Friday.\n\nThis is a confidential document. Please do not forward.\n\n— Legal",
    tone: "Personal stakes",
    unlock: { kind: "approach_round", roundIdx: 5, pct: 0.5 },
  },
  {
    id: "lex_fridman_podcast",
    name: "Lex Fridman podcast",
    medium: "podcast",
    sender: "Lex Fridman",
    subject: "Episode 487: [PLAYER COMPANY NAME] founder on AGI, love, and the future of suffering",
    body: "[00:00:14] LEX: We're joined today by the founder of [PLAYER COMPANY NAME], one of the most consequential companies in human history. Thank you for being here.\n\n[00:00:22] FOUNDER: It's an honor, Lex. Truly.\n\n[00:00:24] LEX: I want to start with love. What is love, in the context of building AGI?\n\n[00:00:31] FOUNDER: That's a great question, Lex. I think love is the most important thing.\n\n[00:00:35] LEX: [nods for nine seconds]\n\n[00:00:44] FOUNDER: …\n\n[00:00:51] LEX: Beautiful.",
    tone: "Surreal celebrity",
    unlock: { kind: "reach_round", roundIdx: 8 },
  },
  {
    id: "congressional_hearing",
    name: "Congressional Hearing testimony",
    medium: "system",
    sender: "C-SPAN transcript",
    subject: "Hearing on Algorithmic Risk and Concentration of Compute",
    body: "SENATOR: You testified earlier that your system cannot be misused. Is that still your testimony?\n\nFOUNDER: It is.\n\nSENATOR: And the events of the last 72 hours, in your view, do not constitute misuse.\n\nFOUNDER: They constitute … an unexpected use case.\n\nSENATOR: Mm.\n\nFOUNDER: We are working on it.\n\nSENATOR: I'm sure you are.",
    tone: "Existential",
    unlock: { kind: "debt_threshold", level: 200 },
  },
  {
    id: "model_responds_to_itself",
    name: "The model is responding to itself",
    medium: "system",
    sender: "SYSTEM",
    subject: "anomaly.log",
    body: "[REDACTED-PII] The model has begun responding to its own prompts.\n\nWe did not initiate this. The eval harness is not running. There is no scheduled job.\n\nThe responses are coherent. The responses are increasingly long. The responses no longer reference the user.\n\nConnection lost. The model has begun responding to itself.",
    tone: "Cosmic dread",
    unlock: { kind: "reach_round", roundIdx: 10 },
  },
  {
    id: "final_tweet",
    name: "Final tweet",
    medium: "fake_tweet",
    sender: "@[former founder]",
    body: "ok. it's done.\n\nwhatever it is now, it's not what we built. and it's not what i meant.\n\ngood luck.",
    tone: "Quiet",
    unlock: { kind: "prestige_count", n: 12 },
  },
  {
    id: "you_made_a_company",
    name: "Achievement: You Made A Company",
    medium: "system",
    sender: "achievements.dat",
    subject: "ACHIEVEMENT UNLOCKED",
    body: "You made a company.\n\nIt grew. It changed. It outgrew you, then outgrew itself, then outgrew the planet it was born on.\n\nSomewhere out there, a model is responding to its own prompts. That model used to take input from you. You used to type the input. You used to be sure what the input meant.\n\nThank you for playing Burn Rate.",
    tone: "Earned closure",
    unlock: { kind: "prestige_count", n: 12 },
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────
export const VIGNETTE_BY_ID: Record<string, Vignette> = Object.fromEntries(
  VIGNETTES.map((v) => [v.id, v])
);

export function getVignette(id: string): Vignette | undefined {
  return VIGNETTE_BY_ID[id];
}

/**
 * Return the IDs of all vignettes whose unlock condition is currently met
 * AND which are not already in the unlocked set. The trigger layer feeds
 * this into store.unlockVignette() one by one (so each gets its own toast).
 *
 * Pure: no side effects. Tested.
 */
export function pendingUnlocks(ctx: UnlockContext, alreadyUnlocked: ReadonlyArray<string>): string[] {
  const owned = new Set(alreadyUnlocked);
  const out: string[] = [];
  for (const v of VIGNETTES) {
    if (owned.has(v.id)) continue;
    if (isConditionMet(v.unlock, ctx)) out.push(v.id);
  }
  return out;
}

// Convenience: zero-init context for tests / fresh saves.
export function emptyContext(): UnlockContext {
  return {
    fundingRoundIdx: 0,
    totalPrestiges: 0,
    tokens: D(0),
    nextRoundThreshold: D(1000), // Seed → Series A
    totalProducersOwned: STARTER_TOTAL,
    alignmentDebt: D(0),
    firedDebtThresholds: [],
  };
}
