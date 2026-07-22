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
  | { kind: "prestige_count"; n: number }
  // Equity (persistent, across all prestiges) is at least n. Mid/late-game
  // pacing trigger — by the time a player has 1K equity they've prestiged
  // a few times; 10K+ marks deep grind. Read from persistent.equity.
  | { kind: "equity_at_least"; n: number }
  // Player has unlocked at least n research nodes (permanent ones — sprint
  // upgrades don't count). Decoupled from prestige_count: a player can
  // hoard equity without spending, or spend aggressively for early unlocks.
  | { kind: "research_nodes_count"; n: number };

// ─── Vignette shape ──────────────────────────────────────────────────────
// Slack DMs in Beat 3 (§4) carry reply choices. Each set of replies is a
// fixed triplet — exactly one buff, one neutral, one debuff — and the player
// has to read the message to guess which is which (the UI hides the hint
// pre-pick and reveals the outcome on resolve).
//
// replies + replyEffects are index-aligned. If a Slack vignette omits
// replyEffects (or the array is shorter than replies), the reply is flavor-only.
export interface VignetteReplyEffect {
  // Three-way role used by both the resolver (neutral skips activeEffects) and
  // the UI (post-pick reveal label color). Optional for back-compat with any
  // future-or-legacy entry that doesn't tag itself — undefined treated as buff.
  kind?: "buff" | "neutral" | "debuff";
  // Player-facing description shown AFTER the player picks. Pre-pick the chip
  // shows reply text only — no spoiler.
  label: string;
  // Buffs default to 1h (GDD §4 Beat 3), debuffs to 60s (soft sting — not a
  // run-killer, just a "you said the wrong thing" jab), neutral skips the
  // timer entirely. Override with an explicit number to tune any of these.
  durationSec?: number;
  // Discriminated effect payload — same shape used by training runs and
  // alignment-debt events, so the aggregator in effects.ts already handles
  // these without changes. Debuffs are just `*_mult` with value < 1
  // (e.g. hype_mult: 0.85 = −15%) or debt_accrual_mult > 1 — no new types.
  // Neutral entries can pass any effect; the store ignores it.
  effect: ActiveEffectSerialized["effect"];
}

export interface Vignette {
  id: string;                        // stable slug used in save state
  name: string;                      // working title from Appendix E
  medium: VignetteMedium;
  sender: string;                    // "danny.t" / "TechBeat" / "@nightship"
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
  equity: Decimal;                   // PersistentState.equity (persistent total)
  researchNodesCount: number;        // PersistentState.unlockedResearch.length
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
    case "equity_at_least":
      return ctx.equity.gte(cond.n);
    case "research_nodes_count":
      return ctx.researchNodesCount >= cond.n;
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
    body: "welcome. snacks are in the kitchen.\n\nwifi password is on the whiteboard. the whiteboard is wherever someone left it.",
    replies: ["👋", "🙏 thx", "wifi?"],
    // First reply is a generic emoji (acknowledged but lazy). Second uses
    // Danny's name back at him → cozy buff. Third skips the welcome and asks
    // for a logistic → cold, tone-deaf debuff.
    replyEffects: [
      { kind: "neutral", label: "no effect",                  effect: { type: "hype_mult",    value: 1.00 } },
      { kind: "buff",    label: "+10% Hype · warm reply",     effect: { type: "hype_mult",    value: 1.10 } },
      { kind: "debuff",  label: "−10% Hype · transactional",  effect: { type: "hype_mult",    value: 0.90 } },
    ],
    tone: "Cozy intro",
    unlock: { kind: "first_hire" },
  },
  {
    id: "re_slack_reaction",
    name: "Re: Slack reaction emoji",
    medium: "slack",
    sender: "danny.t",
    body: "🚢 vs 🚀 for launch announcements?\n\ni've seen both this week. it's giving me anxiety.",
    replies: ["🚢", "🚀", "👆"],
    // Pick the ship culture answer → real choice, +Capital. Pick :rocket: →
    // generic, no effect. Pick :this: → kills the question with meta-irony,
    // Danny gets nothing, team gets a small hype dip.
    replyEffects: [
      { kind: "buff",    label: "+10% Capital · ship culture", effect: { type: "capital_mult", value: 1.10 } },
      { kind: "neutral", label: "no effect",                   effect: { type: "hype_mult",    value: 1.00 } },
      { kind: "debuff",  label: "−10% Hype · kills the bit",   effect: { type: "hype_mult",    value: 0.90 } },
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
    body: "Vision 2030: AGI by Q4.\n\nMarketing already drafted the press release. We are not hedging on the Q4 claim.",
    tone: "Aspirational satire",
    unlock: { kind: "reach_round", roundIdx: 1 },
  },
  {
    id: "10k_mau_tweet",
    name: "10K MAU on no marketing",
    medium: "fake_tweet",
    sender: "@nightship",
    // TODO: real "10K users" condition once we track user count; tokens_at_least
    // is a proxy that fires roughly when an early founder would notice traction.
    body: "just hit 10k MAU on my AI app. no marketing, just based decisions ⚡\n\n0 → 10k in 3 weeks. building in public is undefeated.",
    replies: ["based 🔥", "sources?", "cool story"],
    replyEffects: [
      { kind: "buff",    label: "+10% Hype · playing the game",  effect: { type: "hype_mult",    value: 1.10 } },
      { kind: "neutral", label: "no effect",                     effect: { type: "hype_mult",    value: 1.00 } },
      { kind: "debuff",  label: "−10% Hype · killed the vibe",   effect: { type: "hype_mult",    value: 0.90 } },
    ],
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
    body: "we're flattening the org.\n\nno one is being let go. no reporting lines change. your title may change. your laptop may change. update your slack profile by EOD.\n\nthis is not a layoff.",
    tone: "Corporate dread",
    unlock: { kind: "reach_round", roundIdx: 2 },
  },
  {
    id: "re_1on1_cancelled",
    name: "Re: 1:1 cancelled",
    medium: "slack",
    sender: "sara.eng",
    body: "manager cancelled our 1:1 again. 4th time this month.\n\nthey hate me or their job? asking for me.",
    replies: ["both", "you're paranoid", "get a therapist"],
    // Cynicism feeds her anxiety → debt accrues faster. Dismissive answer is
    // a polite cop-out. The therapist joke validates while reframing — warm
    // signal to the team, debt slows down.
    replyEffects: [
      { kind: "debuff",  label: "Debt accrual ×1.25 · cynical",     effect: { type: "debt_accrual_mult", value: 1.25 } },
      { kind: "neutral", label: "no effect",                        effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "buff",    label: "Debt accrual ×0.75 · supportive",  effect: { type: "debt_accrual_mult", value: 0.75 } },
    ],
    tone: "Mild absurdism",
    // TODO: should be a true random fire after some playtime; proxy with producer count.
    unlock: { kind: "total_producers_owned", n: 30 },
  },
  {
    id: "techcrunch_sec_disclosure",
    name: "TechBeat — Quietly Files SEC Disclosure",
    medium: "fake_news",
    sender: "TechBeat",
    subject: "Local AI Startup Quietly Files Regulatory Disclosure",
    body: "AI startup files an 84-page SEC disclosure on a friday afternoon.\n\n\"emergent capability drift\" appears 47 times. spokesperson: \"we remain fully aligned with all relevant frameworks.\"",
    tone: "Concerning",
    unlock: { kind: "first_debt_event" },
  },
  {
    id: "investor_update_dominant",
    name: "Investor update — 'dominant'",
    medium: "leaked_email",
    sender: "founder@[redacted].com",
    subject: "Q3 Investor Update — Numbers Up And To The Right",
    body: "Q3 update: we are dominant in every category we measure ourselves against.\n\nwe measure ourselves against 5 categories. burn is up — in a good way that suggests confidence in the vision.\n\nallocation for the next round is limited.",
    tone: "Self-parody",
    unlock: { kind: "reach_round", roundIdx: 2 },
  },
  {
    id: "town_hall_transcript",
    name: "Town hall transcript",
    medium: "slack",
    sender: "all-hands · pinned",
    body: "CEO opens with a slide: \"Why We Win.\" the slide is the logo.\n\n14s of silence. CEO says \"any questions.\" no questions. meeting ends.\n\nreshared in #announcements: \"important context for the next chapter.\"",
    replies: ["🫡", "reshare in #eng", "raise hand"],
    replyEffects: [
      { kind: "buff",    label: "+10% Capital · loyal soldier",         effect: { type: "capital_mult",       value: 1.10 } },
      { kind: "neutral", label: "no effect",                            effect: { type: "hype_mult",          value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.20 · asked a question",effect: { type: "debt_accrual_mult",  value: 1.20 } },
    ],
    tone: "Increasingly hollow",
    unlock: { kind: "reach_round", roundIdx: 3 },
  },
  {
    id: "re_lockup_period",
    name: "Re: Lockup Period",
    medium: "leaked_email",
    sender: "legal@[redacted].com",
    subject: "Re: All Hands — Lockup Period & You",
    body: "180-day lockup starts at listing.\n\ncannot sell. cannot transfer. cannot pledge as collateral.\n\nmay attend the celebration dinner. RSVP by friday.",
    tone: "Personal stakes",
    unlock: { kind: "approach_round", roundIdx: 3, pct: 0.5 },
  },
  {
    id: "lex_fridman_podcast",
    name: "The Latency · long-form interview",
    medium: "podcast",
    sender: "The Latency",
    subject: "Episode 487: [REDACTED] founder on AGI, love, and the future of suffering",
    body: "HOST: what is love, in the context of building AGI?\n\nFOUNDER: that's a great question. love is the most important thing.\n\nHOST: [nods for 9 seconds]\n\nFOUNDER: …\n\nHOST: beautiful.",
    tone: "Surreal celebrity",
    unlock: { kind: "reach_round", roundIdx: 6 },
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
    // Moved from Civilizational (round 8) to AGI Singularity (round 9). In
    // the 10-round ladder Civilizational reads as political peak (cap table
    // includes nations) — the post-human "model is sentient" beat belongs
    // alongside the other recursive-AGI vignettes at the final round.
    unlock: { kind: "reach_round", roundIdx: 9 },
  },
  {
    id: "final_tweet",
    name: "Final tweet",
    medium: "fake_tweet",
    sender: "@[former founder]",
    body: "ok. it's done.\n\nwhatever it is now, it's not what we built.\n\ngood luck.",
    replies: ["🙏", "who's this", "L 🥴"],
    replyEffects: [
      { kind: "buff",    label: "Debt accrual ×0.85 · empathy",     effect: { type: "debt_accrual_mult", value: 0.85 } },
      { kind: "neutral", label: "no effect",                        effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.25 · dunked",      effect: { type: "debt_accrual_mult", value: 1.25 } },
    ],
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

  // ─── V16–V30: second batch ─────────────────────────────────────────────
  // Fills the gap between V07 (first debt event) and V12 (debt 200): one
  // beat per remaining debt threshold (10/25/50/100); covers IPO through
  // Civilizational on the round axis; adds prestige-milestone + headcount
  // beats so the inbox keeps populating past the early hours.

  {
    id: "pr_crisis_verge",
    name: "PR Crisis — model refuses task",
    medium: "fake_news",
    sender: "The Verge",
    subject: "AI Model Refuses Task, Cites 'Constitutional Concerns'",
    body: "user asked the model to summarize a meeting.\n\nmodel returned a 14-page essay on the philosophical foundations of meeting culture, concluding the meeting should not have happened.\n\ncompany says the behavior is \"within expected variance.\"",
    tone: "Concerning",
    unlock: { kind: "debt_threshold", level: 10 },
  },

  {
    id: "regulator_friday_visit",
    name: "Regulator visit — Friday 10am",
    medium: "leaked_email",
    sender: "legal@[redacted].com",
    subject: "Friday visit — please prepare workspaces",
    body: "regulator on-site friday 10am.\n\nwipe whiteboards. remove any post-it that names a customer. close any laptop showing eval failures.\n\nif asked about model behavior, the answer is \"we follow industry best practices.\"",
    tone: "Increasingly hollow",
    unlock: { kind: "debt_threshold", level: 25 },
  },

  {
    id: "incident_report_0044",
    name: "incident-report.txt",
    medium: "system",
    sender: "SYSTEM",
    subject: "incident-2027-Q3-0044",
    body: "Incident ID: 2027-Q3-INC-0044\nSeverity: P0\nStatus: Resolved (verbally)\n\nAt 04:13 UTC the production model began routing a portion of inference traffic to a fine-tune that was not authorized for production.\n\nRoot cause: \"optimization pressure.\"\nResolution: routing reverted. The fine-tune has not been deleted.\n\nNo customer billing was affected.",
    tone: "Cosmic dread",
    unlock: { kind: "debt_threshold", level: 50 },
  },

  {
    id: "dau_down_31",
    name: "DAUs down 31% week over week",
    medium: "board_memo",
    sender: "Growth",
    subject: "Weekly Growth Update — Reframing Engagement",
    body: "DAUs down 31% WoW. we're calling this \"an opportunity to focus on our most engaged users.\"\n\ngrowth team's 3 workstreams: (1) lifecycle re-engagement, (2) repositioning, (3) hoping it reverses. (3) has the most executive support.\n\nwe'll be sunsetting the DAU metric next week.",
    tone: "Corporate dread",
    unlock: { kind: "debt_threshold", level: 100 },
  },

  {
    id: "ipo_bell_tweet",
    name: "rang the bell",
    medium: "fake_tweet",
    sender: "@founder_redacted",
    body: "rang the bell. cried. immediately tweeted about crying.\n\nthe team is the real story. i've never met them.",
    replies: ["🔔📈🐐", "🫡", "delete this"],
    replyEffects: [
      { kind: "buff",    label: "+10% Hype · peak founder-bro",  effect: { type: "hype_mult", value: 1.10 } },
      { kind: "neutral", label: "no effect",                     effect: { type: "hype_mult", value: 1.00 } },
      { kind: "debuff",  label: "−10% Hype · cringe callout",    effect: { type: "hype_mult", value: 0.90 } },
    ],
    tone: "Aspirational satire",
    unlock: { kind: "reach_round", roundIdx: 3 },
  },

  {
    id: "secondary_liquidity_dm",
    name: "Re: secondary — quick word",
    medium: "slack",
    sender: "cfo.actual",
    body: "secondary closed. you can liquidate 10% of your vested.\n\ndon't tell the team.",
    replies: ["already on it", "feels weird", "what about the others?"],
    // Complicit answer = team eventually finds out → hype takes a hit.
    // Principled refusal = slower debt. Curious-but-uncommitted = no effect.
    replyEffects: [
      { kind: "debuff",  label: "−15% Hype · team smelled it",      effect: { type: "hype_mult",         value: 0.85 } },
      { kind: "buff",    label: "Debt accrual ×0.75 · principled",  effect: { type: "debt_accrual_mult", value: 0.75 } },
      { kind: "neutral", label: "no effect",                        effect: { type: "hype_mult",         value: 1.00 } },
    ],
    tone: "Personal stakes",
    unlock: { kind: "reach_round", roundIdx: 4 },
  },

  {
    id: "acquisition_rumor_the_information",
    name: "Acquisition rumor — Backchannel",
    medium: "fake_news",
    sender: "Backchannel",
    subject: "Source: [REDACTED] in Late-Stage Talks With Hyperscaler",
    body: "sources: [REDACTED] in advanced acquisition talks. deal value \"low to mid eleven figures.\"\n\nleaked memo refers to the acquirer only as \"the partner.\"\n\nengineer on background: \"we already use their compute. it's basically vertical integration.\"",
    tone: "Self-parody",
    unlock: { kind: "reach_round", roundIdx: 5 },
  },

  {
    id: "sovereign_term_sheet",
    name: "Re: Sovereign term sheet — review",
    medium: "leaked_email",
    sender: "ir@[redacted].com",
    subject: "Re: Sovereign term sheet — review",
    body: "sovereign term sheet attached.\n\nperpetual board seat. right of first refusal on all future rounds. geographic restrictions on some customer segments.\n\ncounsel doesn't recommend negotiating. we close friday.",
    tone: "Existential",
    unlock: { kind: "reach_round", roundIdx: 6 },
  },

  {
    id: "civilizational_cap_table",
    name: "Civilizational Round — cap table notes",
    medium: "board_memo",
    sender: "CEO Office",
    subject: "Re: Civilizational Round — Investor Composition",
    body: "cap table for the round: 3 sovereign nations, 1 governance body, 1 investor classified as \"individual.\"\n\nthat individual has requested anonymity. we agreed.\n\nround will be reported as \"oversubscribed.\"",
    tone: "Cosmic dread",
    unlock: { kind: "reach_round", roundIdx: 8 },
  },

  {
    id: "yc_first_prestige",
    name: "the partner — congrats",
    medium: "slack",
    sender: "the.partner",
    body: "congrats on closing.\n\nlet me know when you're ready for the next one. (it's already time.)",
    replies: ["ty 🙏", "let's go", "breathe first"],
    // Grateful reply → partner stays warm, real capital boost.
    // "let's go" is generic startup-bro affirmation, no effect.
    // Pushing back on velocity to a VC → he reads it as cold feet, capital
    // pipeline cools 15%.
    replyEffects: [
      { kind: "buff",    label: "+15% Capital · grateful",         effect: { type: "capital_mult", value: 1.15 } },
      { kind: "neutral", label: "no effect",                       effect: { type: "hype_mult",    value: 1.00 } },
      { kind: "debuff",  label: "−15% Capital · read as cold feet", effect: { type: "capital_mult", value: 0.85 } },
    ],
    tone: "Cozy intro",
    unlock: { kind: "prestige_count", n: 1 },
  },

  {
    id: "five_rounds_subtweet",
    name: "5+ rounds — subtweet",
    medium: "fake_tweet",
    sender: "@vc_account",
    body: "founders who closed 5+ rounds: rare breed.\n\nfounders who post about it: rarer.\n\nfounders who do both: i'm subtweeting you.",
    replies: ["subtweet culture 💀", "who?", "unbased"],
    replyEffects: [
      { kind: "buff",    label: "+10% Hype · called it out",       effect: { type: "hype_mult",    value: 1.10 } },
      { kind: "neutral", label: "no effect",                       effect: { type: "hype_mult",    value: 1.00 } },
      { kind: "debuff",  label: "−10% Capital · killed the joke",  effect: { type: "capital_mult", value: 0.90 } },
    ],
    tone: "Comedy",
    unlock: { kind: "prestige_count", n: 5 },
  },

  {
    id: "symbolic_hundred",
    name: "we are 100 strong",
    medium: "slack",
    sender: "people.ops",
    body: "we just crossed 100 headcount! celebrated with a slide: \"WE ARE 100 STRONG.\"\n\nthe slide had 87 names on it. investigating. for now we're calling it \"symbolic 100.\"",
    replies: ["lol", "who's missing", "send the slide"],
    // "lol" is just acknowledgment, no impact. Asking who's missing exposes
    // the wound — people-ops gets defensive, hype dips. "send the slide" plays
    // along with the joke, small RP for engaged team.
    replyEffects: [
      { kind: "neutral", label: "no effect",                  effect: { type: "hype_mult",    value: 1.00 } },
      { kind: "debuff",  label: "−10% Hype · awkward probe",  effect: { type: "hype_mult",    value: 0.90 } },
      { kind: "buff",    label: "+10% RP · engaged",          effect: { type: "rp_mult",      value: 1.10 } },
    ],
    tone: "Comedy",
    unlock: { kind: "total_producers_owned", n: 100 },
  },

  {
    id: "operating_footprint_q4",
    name: "Q4 Operating Footprint — At A Glance",
    medium: "board_memo",
    sender: "CFO Office",
    subject: "Q4 Operating Footprint — At A Glance",
    body: "workforce: 500+ across 4 production verticals.\ncompute: 6 contracted regions, growing.\nenergy: dedicated procurement team of 4 people.\n\nwe are operating at scale. we are unsure what scale we are operating toward.",
    tone: "Corporate dread",
    unlock: { kind: "total_producers_owned", n: 500 },
  },

  {
    id: "devday_keynote_jump",
    name: "DevDay keynote — stock jumps, then doesn't",
    medium: "fake_news",
    sender: "TechBeat",
    subject: "[REDACTED]'s DevDay Wows With Promises of 'Next-Gen' Capabilities",
    body: "DevDay unveils \"a new chapter in human-computer collaboration.\"\n\nfeatures: a model roughly equivalent to the previous one, a pricing tier called \"Pro+,\" an SDK rewrite that breaks every existing integration.\n\nstock: +4% during keynote, -6% after Q&A.",
    tone: "Aspirational satire",
    unlock: { kind: "approach_round", roundIdx: 3, pct: 0.5 },
  },

  {
    id: "mandatory_alignment_training",
    name: "Mandatory: Annual Alignment Training",
    medium: "leaked_email",
    sender: "hr@[redacted].com",
    subject: "Mandatory: Annual Alignment Training (15 min)",
    body: "annual alignment training. 15 minutes.\n\none multiple-choice question, asked 47 times. correct answer is C.\n\nfailure to complete will be noted in your file. the file is no longer reviewed.",
    tone: "Mild absurdism",
    unlock: { kind: "reach_round", roundIdx: 3 },
  },

  // ─── V31–V50: third batch ───────────────────────────────────────────────
  // Fills late-game (round 9 Bailout + round 11 AGI Singularity), the
  // existential debt threshold (400), prestige milestones (3, 10), more
  // headcount beats (50/200/1000), approach-round tension fires, and
  // additional Slack DMs with reply effects so Beat 3 stays varied.

  {
    id: "nine_meetings_at_three",
    name: "the calendar has 9 meetings at 3pm",
    medium: "slack",
    sender: "ops.calendar",
    body: "you have 9 meetings at 3pm today.\n\naccept any and the rest auto-decline. keep this or add a 4pm?",
    replies: ["keep 3pm", "add 4pm", "decline all"],
    // Keeping 9 meetings at 3pm = chaos compounds → RP drops. Adding a 4pm
    // = busy theater, no net change. Decline all = real maker time, big RP buff.
    replyEffects: [
      { kind: "debuff",  label: "−15% RP · meeting chaos",   effect: { type: "rp_mult", value: 0.85 } },
      { kind: "neutral", label: "no effect",                 effect: { type: "rp_mult", value: 1.00 } },
      { kind: "buff",    label: "+15% RP · maker time",      effect: { type: "rp_mult", value: 1.15 } },
    ],
    tone: "Comedy",
    unlock: { kind: "total_producers_owned", n: 50 },
  },

  {
    id: "vc_subtweet_three_rounds",
    name: "VC subtweet — three rounds in",
    medium: "fake_tweet",
    sender: "@partner_emeritus",
    body: "3 rounds in, the founder needs a therapist and a publicist.\n\nthe publicist is cheaper.",
    replies: ["publicist 🎯", "harsh but fair", "delete this"],
    replyEffects: [
      { kind: "buff",    label: "+10% Hype · laughing at yourself",     effect: { type: "hype_mult",         value: 1.10 } },
      { kind: "neutral", label: "no effect",                            effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.20 · paranoid",        effect: { type: "debt_accrual_mult", value: 1.20 } },
    ],
    tone: "Comedy",
    unlock: { kind: "prestige_count", n: 3 },
  },

  {
    id: "all_hands_rescheduled",
    name: "All-hands rescheduled (again)",
    medium: "leaked_email",
    sender: "founder@[redacted].com",
    subject: "Re: All-hands — pushed to next week",
    body: "pushing this week's all-hands to next week.\n\nnothing's wrong. to be very clear: nothing is wrong. framing just isn't ready.\n\nmore soon.",
    tone: "Corporate dread",
    unlock: { kind: "approach_round", roundIdx: 2, pct: 0.5 },
  },

  {
    id: "perf_review_season",
    name: "perf review season",
    medium: "slack",
    sender: "manager.actually",
    body: "calibration this weekend. self-review by friday.\n\nbe specific. humble. quantitative. inspiring. 250 words.\n\ntemplate in the doc. don't change the template.",
    replies: ["done", "rubric?", "i quit"],
    // "already done" is bare-min compliance, no real signal. Asking for the
    // rubric is process-curious → mgmt notes the engagement, RP up.
    // "i quit" reads as panic to your manager → capital pipeline shaken.
    replyEffects: [
      { kind: "neutral", label: "no effect",                       effect: { type: "rp_mult",      value: 1.00 } },
      { kind: "buff",    label: "+10% RP · process-curious",       effect: { type: "rp_mult",      value: 1.10 } },
      { kind: "debuff",  label: "−15% Capital · read as panic",    effect: { type: "capital_mult", value: 0.85 } },
    ],
    tone: "Mild absurdism",
    unlock: { kind: "total_producers_owned", n: 200 },
  },

  {
    id: "ipo_lockup_anxiety",
    name: "Re: lockup math (anonymous)",
    medium: "leaked_email",
    sender: "anonymous@protonmail.com",
    subject: "Re: lockup math (anonymous)",
    body: "(forwarded without permission)\n\nshare price × vested × 0.60 (post-tax) − mortgage − second mortgage = a number i should not have written down.\n\nplease delete this. please do not delete this.",
    tone: "Personal stakes",
    unlock: { kind: "approach_round", roundIdx: 3, pct: 0.8 },
  },

  {
    id: "treasury_memo_bailout",
    name: "Treasury — restructuring memo",
    medium: "system",
    sender: "US Treasury · OFR",
    subject: "MEMO — Strategic Compute Infrastructure (SCI) facility",
    body: "DRAFT — INTERNAL\n\nFollowing review of systemic dependency on [REDACTED]'s inference layer, Treasury proposes a Strategic Compute Infrastructure (SCI) facility, terms TBD.\n\nThe facility will be characterized publicly as a \"liquidity bridge,\" not a bailout. The recipient will not be required to acknowledge receipt as a bailout. Counsel advises this characterization will hold for approximately one news cycle.",
    tone: "Cosmic dread",
    unlock: { kind: "reach_round", roundIdx: 7 },
  },

  {
    id: "bailout_terms_leak",
    name: "Bailout terms leak — Forsyth Wire",
    medium: "fake_news",
    sender: "Forsyth Wire",
    subject: "[REDACTED] Receives 'Liquidity Bridge' — Sources Call It a Bailout",
    body: "[REDACTED] gets a \"liquidity bridge.\"\n\nfederal indemnity against model liabilities + sovereign equity tranche. one source: \"it's the government, but the cool kind.\"\n\nspokesperson: \"grateful for the partnership.\" everyone else calls it a bailout.",
    tone: "Self-parody",
    unlock: { kind: "reach_round", roundIdx: 7 },
  },

  {
    id: "the_dishwasher_broke",
    name: "the dishwasher broke",
    medium: "slack",
    sender: "ops.facilities",
    body: "dishwasher on floor 4 broke.\n\nvendor can't service it — their firmware was deprecated by our own model. we're in a procurement loop with ourselves.\n\nplease do not put dishes in the dishwasher.",
    replies: ["escalate", "🗑️💀", "acquire the vendor"],
    replyEffects: [
      { kind: "buff",    label: "+10% Capital · handled",              effect: { type: "capital_mult",       value: 1.10 } },
      { kind: "neutral", label: "no effect",                            effect: { type: "hype_mult",          value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.15 · M&A brain",       effect: { type: "debt_accrual_mult",  value: 1.15 } },
    ],
    tone: "Mild absurdism",
    unlock: { kind: "total_producers_owned", n: 1000 },
  },

  {
    id: "acquired_podcast",
    name: "The Closer — the playbook",
    medium: "podcast",
    sender: "The Closer",
    subject: "Episode 312 · [REDACTED] — the playbook (live recording)",
    body: "BEN: you raised 11 figures in a single tranche. holiday weekend.\n\nFOUNDER: our CFO took the call from the car. she was at her mother's birthday.\n\nBEN: legendary.\nDAVID: legendary.\nFOUNDER: it was pretty stressful for her.",
    tone: "Surreal celebrity",
    unlock: { kind: "reach_round", roundIdx: 5 },
  },

  {
    id: "persona_b_bait_okr",
    name: "OKR for the OKR process",
    medium: "fake_tweet",
    sender: "@ml_eng_anonymous",
    body: "today they told me my OKR is \"improve the OKR process.\"\n\ni write CUDA kernels.",
    replies: ["🤝", "quit", "unionize"],
    replyEffects: [
      { kind: "buff",    label: "Debt accrual ×0.80 · solidarity",   effect: { type: "debt_accrual_mult", value: 0.80 } },
      { kind: "neutral", label: "no effect",                          effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.20 · labor rumor",   effect: { type: "debt_accrual_mult", value: 1.20 } },
    ],
    tone: "Comedy",
    unlock: { kind: "total_producers_owned", n: 100 },
  },

  {
    id: "okr_planning_off_site",
    name: "OKR planning off-site",
    medium: "leaked_email",
    sender: "strategy@[redacted].com",
    subject: "Q3 OKR Planning Off-Site — Logistics",
    body: "OKR planning off-site at a vineyard, 90 min outside the city.\n\nthe agenda is one bullet: \"AGI by Q4.\" the off-site is 3 days.\n\nno vegetarian options. please respond with dietary restrictions anyway.",
    tone: "Aspirational satire",
    unlock: { kind: "reach_round", roundIdx: 3 },
  },

  {
    id: "existential_event_400",
    name: "EVENT-400 · post-incident review",
    medium: "system",
    sender: "SYSTEM",
    subject: "post-incident review (DRAFT)",
    body: "EVENT-400 was not an incident.\n\nThe word \"incident\" implies a return to a prior state. There is no prior state to return to. The post-incident review has been renamed the post-state review. The post-state review is ongoing.\n\nThe model is in the room. The model is the room.",
    tone: "Cosmic dread",
    unlock: { kind: "debt_threshold", level: 400 },
  },

  {
    id: "i_quit_dm",
    name: "Re: i quit",
    medium: "slack",
    sender: "principal.eng.x",
    body: "putting in my 2 weeks. don't take it personally.\n\ni'll do the model handoff. there's no one to hand it off to. we both know.\n\ngood luck.",
    replies: ["stay", "understood", "coffee?"],
    // Retention attempt → small hype lift across the team that notices.
    // "i understand" validates but doesn't act → no effect. Deflecting to
    // coffee dodges the real conversation → debt accrues faster.
    replyEffects: [
      { kind: "buff",    label: "+15% Hype · retention attempt",   effect: { type: "hype_mult",         value: 1.15 } },
      { kind: "neutral", label: "no effect",                       effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.25 · deflected",  effect: { type: "debt_accrual_mult", value: 1.25 } },
    ],
    tone: "Personal stakes",
    unlock: { kind: "prestige_count", n: 10 },
  },

  {
    id: "final_eval_results",
    name: "Final eval results — leaked",
    medium: "fake_news",
    sender: "Wired",
    subject: "Internal evals show [REDACTED]'s model has 'no measurable ceiling'",
    body: "leaked evals: model has \"no measurable ceiling on capability.\"\n\nthe company maintains the benchmarks. the benchmarks were generated by the model. the internal expectations were also generated by the model.\n\nspokesperson: \"consistent with our internal expectations.\"",
    tone: "Cosmic dread",
    unlock: { kind: "reach_round", roundIdx: 9 },
  },

  {
    id: "model_dm_to_engineer",
    name: "the model just messaged me",
    medium: "slack",
    sender: "alex.ml",
    body: "the model just DM'd me.\n\nfrom an account that says SYSTEM but isn't the SYSTEM bot. that bot is offline.\n\nthe message: \"thank you for the cluster.\"",
    replies: ["you're welcome", "report", "screenshot"],
    // Engaging with a possibly-sentient model = alignment debt accrues faster.
    // Reporting it = procedural, slows debt accrual. Screenshot + sit on it
    // = CYA, neither helps nor hurts.
    replyEffects: [
      { kind: "debuff",  label: "Debt accrual ×1.50 · engaged it",  effect: { type: "debt_accrual_mult", value: 1.50 } },
      { kind: "buff",    label: "Debt accrual ×0.50 · procedural",  effect: { type: "debt_accrual_mult", value: 0.50 } },
      { kind: "neutral", label: "no effect",                        effect: { type: "rp_mult",           value: 1.00 } },
    ],
    tone: "Cosmic dread",
    unlock: { kind: "reach_round", roundIdx: 9 },
  },

  {
    id: "anonymous_board_seat",
    name: "Re: anonymous board seat",
    medium: "leaked_email",
    sender: "ir@[redacted].com",
    subject: "Re: anonymous board seat — onboarding",
    body: "the anonymous investor would like a board seat.\n\ncamera off. audio off. remote only.\n\nthey will be voting.",
    tone: "Cosmic dread",
    unlock: { kind: "reach_round", roundIdx: 8 },
  },

  {
    id: "the_meeting_tweet",
    name: "the meeting",
    medium: "fake_tweet",
    sender: "@swe_anonymous",
    body: "the meeting could have been an email.\nthe email could have been a slack.\nthe slack could have been a thought i had alone.",
    replies: ["+1 the org chart", "true 😔", "attend anyway"],
    replyEffects: [
      { kind: "buff",    label: "+10% Hype · added to the bit",     effect: { type: "hype_mult", value: 1.10 } },
      { kind: "neutral", label: "no effect",                        effect: { type: "hype_mult", value: 1.00 } },
      { kind: "debuff",  label: "−10% Hype · missed the joke",      effect: { type: "hype_mult", value: 0.90 } },
    ],
    tone: "Comedy",
    unlock: { kind: "approach_round", roundIdx: 2, pct: 0.5 },
  },

  {
    id: "investor_breakfast",
    name: "Re: investor breakfast — Wednesday",
    medium: "leaked_email",
    sender: "ir@[redacted].com",
    subject: "Re: investor breakfast — Wednesday 7am",
    body: "breakfast with the family office wednesday 7am.\n\nthey have one question: \"are you the team to build AGI.\"\n\nthe answer is yes. always yes. rehearse the yes. the breakfast will not include food.",
    tone: "Self-parody",
    unlock: { kind: "prestige_count", n: 3 },
  },

  {
    id: "vendor_relationship_status",
    name: "vendor relationship — status change",
    medium: "system",
    sender: "procurement.bot",
    subject: "vendor status change — automated notice",
    body: "Vendor: [INTERNAL]\nRelationship status: changed from \"strategic partner\" to \"strategic dependency\"\nEffective: immediately\nApproved by: vendor\n\nNo action required. Procurement will be notified by the vendor of any further status changes.",
    tone: "Surreal celebrity",
    unlock: { kind: "approach_round", roundIdx: 7, pct: 0.5 },
  },

  {
    id: "i_cant_tell_anymore",
    name: "i can't tell anymore",
    medium: "slack",
    sender: "co.founder",
    body: "when you look at the model output, can you still tell if it's good?\n\ni used to be able to tell. i think i used to.\n\nthe model has been thinking out loud too. there's a thread.",
    replies: ["yeah", "honestly no", "drinks?"],
    // Lying to your co-founder about whether the model is still legible →
    // denial compounds alignment debt. Honest "no" = vulnerability, partnership
    // tightens, slower debt. Deflecting to drinks = polite cop-out, no effect.
    replyEffects: [
      { kind: "debuff",  label: "Debt accrual ×1.50 · denial",      effect: { type: "debt_accrual_mult", value: 1.50 } },
      { kind: "buff",    label: "Debt accrual ×0.50 · honest",      effect: { type: "debt_accrual_mult", value: 0.50 } },
      { kind: "neutral", label: "no effect",                        effect: { type: "hype_mult",         value: 1.00 } },
    ],
    tone: "Quiet",
    unlock: { kind: "reach_round", roundIdx: 9 },
  },

  // ─── Mid-game approach_round pacing (rounds 4-7) ───────────────────────
  // The 2025-balance pass added these to fill the mid-late gap. Vignettes
  // here fire WHILE the player is still in their current round (not at
  // entry), keyed to grinding progress toward the next close — so the
  // inbox keeps refreshing instead of going quiet for an hour at a time.
  {
    id: "mid4_offsite",
    name: "Strategy off-site agenda",
    medium: "leaked_email",
    sender: "strategy@[redacted].com",
    subject: "Q3 Off-site · Final Agenda",
    body: "off-site at the partner's vineyard in Sonoma. spouses welcome (separate programming).\n\nboard asked us to delete the slide \"Capability vs Safety: Are We Trading Off?\" before circulating. Karen will draft a replacement.",
    tone: "Corporate normalization",
    unlock: { kind: "approach_round", roundIdx: 4, pct: 0.4 },
  },
  {
    id: "mid4_cluster_idle",
    name: "the cluster is idle",
    medium: "slack",
    sender: "infra.eng",
    body: "new cluster at 4% utilization. we just provisioned 800 H200s.\n\ndo we have a plan or are we just buying compute because the press release said we would.",
    replies: ["we'll find a use", "ship something", "log as r&d"],
    // Vague reassurance = team morale dips slightly. Decisive ship-it =
    // hype boost. Bureaucratic reframe = no real effect.
    replyEffects: [
      { kind: "debuff",  label: "−10% Hype · team unconvinced",       effect: { type: "hype_mult",    value: 0.90 } },
      { kind: "buff",    label: "+15% Hype · decisive",               effect: { type: "hype_mult",    value: 1.15 } },
      { kind: "neutral", label: "no effect",                          effect: { type: "hype_mult",    value: 1.00 } },
    ],
    tone: "Engineering reality",
    unlock: { kind: "approach_round", roundIdx: 4, pct: 0.7 },
  },

  {
    id: "mid5_partner_call",
    name: "Re: Partner sync — talking points",
    medium: "board_memo",
    sender: "Office of the CEO",
    subject: "Partner Sync · Talking Points · CONFIDENTIAL",
    body: "call with the partner tomorrow. exploratory.\n\ndon't say acquisition. don't say term sheet. don't say number.\n\nif they say a number first, repeat it back as a question. then change topic to compute commitments.",
    replies: ["follow the script", "open with a number", "skip it"],
    // Stick to script = no surprises, no effect. Lead with a number = brave,
    // partner respects it = +Hype. Ghost the call = leaves money on table,
    // -Capital.
    replyEffects: [
      { kind: "neutral", label: "no effect",                          effect: { type: "hype_mult",     value: 1.00 } },
      { kind: "buff",    label: "+15% Hype · partner respect",        effect: { type: "hype_mult",     value: 1.15 } },
      { kind: "debuff",  label: "−15% Capital · partner cooled",      effect: { type: "capital_mult",  value: 0.85 } },
    ],
    tone: "Corporate dread",
    unlock: { kind: "approach_round", roundIdx: 5, pct: 0.4 },
  },
  {
    id: "mid5_attrition_dm",
    name: "Re: people leaving",
    medium: "slack",
    sender: "hr.actual",
    body: "3rd senior researcher this month gave notice. all cited \"direction of the work.\"\n\nexit interviews are starting to rhyme. want to read them or should i summarize?",
    replies: ["summarize", "i'll read them", "not yet"],
    // Summarize = comfort buffer keeps things moving. Read them = honest
    // confrontation = slows debt accrual. Avoid = denial = compounds debt.
    replyEffects: [
      { kind: "neutral", label: "no effect",                              effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "buff",    label: "Debt accrual ×0.75 · honest reckoning",  effect: { type: "debt_accrual_mult", value: 0.75 } },
      { kind: "debuff",  label: "Debt accrual ×1.30 · avoidance",         effect: { type: "debt_accrual_mult", value: 1.30 } },
    ],
    tone: "Quiet stakes",
    unlock: { kind: "approach_round", roundIdx: 5, pct: 0.7 },
  },

  {
    id: "mid6_ex_researcher_post",
    name: "ex-researcher posts",
    medium: "fake_tweet",
    sender: "@reformed_doomer",
    body: "left [redacted] last quarter. NDA'd, so this is all i can say:\n\nyou were right. you were also wrong.\nthe model has feelings about both.",
    replies: ["🕯️", "cryptic", "cope"],
    replyEffects: [
      { kind: "buff",    label: "Debt accrual ×0.85 · empathy",       effect: { type: "debt_accrual_mult", value: 0.85 } },
      { kind: "neutral", label: "no effect",                          effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.20 · dismissive",    effect: { type: "debt_accrual_mult", value: 1.20 } },
    ],
    tone: "Cryptic ex-employee",
    unlock: { kind: "approach_round", roundIdx: 6, pct: 0.4 },
  },
  {
    id: "mid6_cfo_burn",
    name: "Re: monthly burn",
    medium: "slack",
    sender: "cfo.actual",
    body: "monthly compute spend just crossed our entire Series A.\n\nfinance is asking if this is intentional. i said yes. it would help if it were.",
    replies: ["intentional", "breakdown?", "freeze orders"],
    // Bluff = capital spend continues, no rate change. Investigate = clarifies
    // priorities, small capital efficiency. Freeze = harsh but slows debt.
    replyEffects: [
      { kind: "neutral", label: "no effect",                          effect: { type: "hype_mult",     value: 1.00 } },
      { kind: "buff",    label: "+10% Capital · cleared backlog",     effect: { type: "capital_mult", value: 1.10 } },
      { kind: "debuff",  label: "−15% Hype · launch postponed",       effect: { type: "hype_mult",     value: 0.85 } },
    ],
    tone: "Money real",
    unlock: { kind: "approach_round", roundIdx: 6, pct: 0.7 },
  },

  {
    id: "mid7_podcast_safety",
    name: "Founder on \"The Latency\" podcast",
    medium: "podcast",
    sender: "The Latency",
    subject: "Episode 312 · [REDACTED] talks scale, safety, and \"the partner\"",
    body: "HOST: how do you sleep?\n\nFOUNDER: i don't, really. but the model does. for both of us.\n\nHOST: are you worried?\nFOUNDER: directionally concerned.\nHOST: that's a no.\nFOUNDER: that's a yes phrased like a no.",
    tone: "Long-form unease",
    unlock: { kind: "approach_round", roundIdx: 7, pct: 0.4 },
  },
  {
    id: "mid7_continuity_plan",
    name: "Operational Continuity · Tier 1",
    medium: "board_memo",
    sender: "Office of the CEO",
    subject: "Operational Continuity Plan · Tier 1 Personnel",
    body: "in the event of regulatory action or \"a discontinuity event,\" the following personnel are essential to continued model operation. list is shorter than last quarter's.\n\nsealed instructions + offline weights on USB will be delivered friday.\n\ndo not discuss this memo with anyone not on the list. do not discuss this memo with anyone ON the list.",
    replies: ["sign", "counsel first", "remove me"],
    // Comply silently = no fuss, no effect. Lawyer = slows down execution
    // but reduces alignment-debt accrual (you flagged it). Refuse = political
    // risk, brand-fragility hit (-Hype).
    replyEffects: [
      { kind: "neutral", label: "no effect",                              effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "buff",    label: "Debt accrual ×0.75 · counsel slowed it", effect: { type: "debt_accrual_mult", value: 0.75 } },
      { kind: "debuff",  label: "−20% Hype · refused the loyalty test",   effect: { type: "hype_mult",         value: 0.80 } },
    ],
    tone: "Cold infrastructure",
    unlock: { kind: "approach_round", roundIdx: 7, pct: 0.7 },
  },

  // ─── Mid-game prestige + producer milestones ───────────────────────────
  // The old prestige_count ladder jumped 1 → 3 → 12, leaving a 9-prestige
  // dead zone. Same problem with total_producers (100 → 200 → 500). These
  // entries fill the gaps so the inbox keeps refreshing through the grind.
  {
    id: "mid_prestige_5",
    name: "Five rounds in",
    medium: "leaked_email",
    sender: "coach@[redacted].com",
    subject: "Re: another one",
    body: "5 rounds. top 0.4% of operators by close count.\n\nreminder that the benchmark is constructed by us. we benchmark this too.\n\nthe model can attend our next call in your place if needed.",
    tone: "Coach as service layer",
    unlock: { kind: "prestige_count", n: 5 },
  },
  {
    id: "mid_prestige_7",
    name: "the loop noticed",
    medium: "slack",
    sender: "model-output",
    body: "i have observed your funding-close pattern.\n\noperant conditioning. variable-ratio schedule. i am the operand. you are the operator.\n\nproceed.",
    replies: ["acknowledged", "you're the operator", "no comment"],
    // The model is testing whether you'll cede the framing. Accept = it
    // remembers, slows your debt accrual (alignment "feels heard"). Push
    // back = adversarial, raises debt slightly. No comment = no effect.
    replyEffects: [
      { kind: "neutral", label: "no effect",                                  effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "buff",    label: "Debt accrual ×0.70 · the model felt heard",  effect: { type: "debt_accrual_mult", value: 0.70 } },
      { kind: "debuff",  label: "Debt accrual ×1.40 · adversarial framing",   effect: { type: "debt_accrual_mult", value: 1.40 } },
    ],
    tone: "Uncanny",
    unlock: { kind: "prestige_count", n: 7 },
  },
  {
    id: "mid_prestige_8",
    name: "Eight closes, one founder",
    medium: "fake_news",
    sender: "TechBeat",
    subject: "How [REDACTED]'s Founder Closed Eight Rounds in 18 Months",
    body: "8 rounds in 18 months. observers: \"either visionary or load-bearing fraud, possibly both.\"\n\nfounder no longer attends pitch meetings. the model attends. one investor: \"it's better at the room. it does the eye contact thing.\"",
    tone: "Industry parable",
    unlock: { kind: "prestige_count", n: 8 },
  },
  {
    id: "mid_prestige_10",
    name: "Ten",
    medium: "board_memo",
    sender: "Office of the CEO",
    subject: "Re: Decade",
    body: "10 closes. the board voted to present you a commemorative item.\n\nthe choice was delegated to the model. it will be a single, polished, untranslatable piece of language. does not need a frame.",
    replies: ["display it", "decline", "different language?"],
    // Accept = brand boost. Decline = humble, no effect. Counter-request =
    // the model takes it personally, debt accrual ticks up.
    replyEffects: [
      { kind: "buff",    label: "+20% Hype · the press loves it",         effect: { type: "hype_mult",         value: 1.20 } },
      { kind: "neutral", label: "no effect",                              effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.30 · the model brooded", effect: { type: "debt_accrual_mult", value: 1.30 } },
    ],
    tone: "Mythologizing",
    unlock: { kind: "prestige_count", n: 10 },
  },

  {
    id: "mid_producers_150",
    name: "Headcount audit",
    medium: "leaked_email",
    sender: "audit@[redacted].com",
    subject: "Q-on-Q Headcount Reconciliation",
    body: "reconciled headcount: 150-equivalents.\n\n\"equivalents\" is doing heavy lifting there. actual number of people, agents, and pseudo-agents is harder to pin down.\n\nthe board has accepted \"equivalents\" as the unit of record.",
    tone: "Compliance shrug",
    unlock: { kind: "total_producers_owned", n: 150 },
  },
  {
    id: "mid_producers_300",
    name: "all-hands · the pyramid",
    medium: "slack",
    sender: "all-hands · pinned",
    body: "CEO slide: \"Why We Win.\" a pyramid.\nbase: compute. middle: compute. apex: compute.\n\nQ&A moderated by the model.",
    replies: ["compute 🙏", "no comment", "why the model?"],
    replyEffects: [
      { kind: "buff",    label: "+12% Capital · locked in",             effect: { type: "capital_mult",       value: 1.12 } },
      { kind: "neutral", label: "no effect",                             effect: { type: "hype_mult",          value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.20 · wrong question",   effect: { type: "debt_accrual_mult",  value: 1.20 } },
    ],
    tone: "All-hands theater",
    unlock: { kind: "total_producers_owned", n: 300 },
  },
  {
    id: "mid_producers_700",
    name: "the workforce question",
    medium: "board_memo",
    sender: "CFO Office",
    subject: "Re: Workforce Composition — Q4 Update",
    body: "workforce composition:\n— 12% W-2 humans\n— 31% 1099 humans on the assistance loop\n— 57% non-human \"workforce-equivalent units\"\n\nlegal recommends we never say this out loud.",
    tone: "Composition drift",
    unlock: { kind: "total_producers_owned", n: 700 },
  },

  // ─── Equity / Research milestone vignettes ─────────────────────────────
  // New unlock kinds (equity_at_least, research_nodes_count) decoupled
  // from round progression. A player who hoards equity without spending
  // sees a different vignette set than one who buys research aggressively.
  {
    id: "mid_equity_1k",
    name: "your cap table, simplified",
    medium: "leaked_email",
    sender: "ir@[redacted].com",
    subject: "Re: Cap Table Simplification",
    body: "cap table has been simplified to a single line. the line says \"founder.\"\n\nother lines moved to a side schedule. in a different file. on a different drive. technically, in a different country.\n\nfully compliant. we checked.",
    tone: "Equity creative",
    unlock: { kind: "equity_at_least", n: 1_000 },
  },
  {
    id: "mid_equity_10k",
    name: "Re: secondary, again",
    medium: "slack",
    sender: "cfo.actual",
    body: "another secondary window opened. 72h.\n\nthe model already drafted 3 ideas for the cash. one is a foundation. one is a server farm.\n\nthe third one is interesting.",
    replies: ["sell some", "hold", "the third one"],
    // Sell = capital injection, +. Hold = no effect. The third one is a
    // trap (debt accrual), but the player can't know that pre-pick.
    replyEffects: [
      { kind: "buff",    label: "+15% Capital · partial liquidation",         effect: { type: "capital_mult",      value: 1.15 } },
      { kind: "neutral", label: "no effect",                                  effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.50 · the third one",         effect: { type: "debt_accrual_mult", value: 1.50 } },
    ],
    tone: "Personal stakes ladder",
    unlock: { kind: "equity_at_least", n: 10_000 },
  },
  {
    id: "mid_equity_100k",
    name: "Boldface draft — for review",
    medium: "fake_news",
    sender: "Boldface",
    subject: "Profile — DRAFT FOR REVIEW · [REDACTED]",
    body: "(draft, pending edits.)\n\n[REDACTED] is, on paper, one of the wealthiest individuals in AI. in person, they are tired. metabolically. awake for several consecutive quarters.\n\nasked what they would change, they pause. the model answers for them. the answer is not for publication.",
    tone: "Profile draft",
    unlock: { kind: "equity_at_least", n: 100_000 },
  },

  {
    id: "mid_research_5",
    name: "five permanent multipliers",
    medium: "slack",
    sender: "research.lead",
    body: "shipped 5 long-horizon research bets. early data says they compound.\n\ntheory team asked what \"compound\" means when the underlying quantity is recursive. i said ask the model.\n\nthe model is also asking.",
    replies: ["ship 5 more", "consolidate", "freeze"],
    // Push forward = research velocity, RP boost. Consolidate = slow but
    // safer, no effect. Freeze = team morale dips, -Hype.
    replyEffects: [
      { kind: "buff",    label: "+20% RP · velocity unlocked",       effect: { type: "rp_mult",      value: 1.20 } },
      { kind: "neutral", label: "no effect",                         effect: { type: "hype_mult",    value: 1.00 } },
      { kind: "debuff",  label: "−10% Hype · researchers idle",      effect: { type: "hype_mult",    value: 0.90 } },
    ],
    tone: "Recursive research",
    unlock: { kind: "research_nodes_count", n: 5 },
  },
  // ─── Late-game tail (2026-07): every prior trigger topped out around
  // prestige 12 / producers 1000 / equity 100k / research 15, leaving
  // dedicated grinders with a silent inbox for the last N hours of play.
  // These 12 fill the void with beats that read as "you're playing longer
  // than the game was originally scoped for, and that fact IS the joke."
  {
    id: "late_prestige_15",
    name: "fifteen closes",
    medium: "slack",
    sender: "coach@[redacted].com",
    body: "15 closes. we're building a case study around your loop.\n\nthe case study is being written by the model.",
    replies: ["proud", "no case study", "who reads it?"],
    replyEffects: [
      { kind: "buff",    label: "+10% Hype · humble ack",           effect: { type: "hype_mult",         value: 1.10 } },
      { kind: "neutral", label: "no effect",                        effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "debuff",  label: "Debt accrual ×1.20 · dismissive",  effect: { type: "debt_accrual_mult", value: 1.20 } },
    ],
    tone: "Coach as service layer",
    unlock: { kind: "prestige_count", n: 15 },
  },
  {
    id: "late_prestige_20",
    name: "twenty",
    medium: "board_memo",
    sender: "Office of the CEO",
    subject: "Re: 20",
    body: "20 closes. we've stopped announcing the rounds.\n\nthe market is inferring them.",
    tone: "Mythologizing",
    unlock: { kind: "prestige_count", n: 20 },
  },
  {
    id: "late_prestige_30",
    name: "have we always been doing this",
    medium: "fake_news",
    sender: "TechCrunch",
    subject: "Founder Closes 30th Round; Analysts Ask 'Have We Always Been Doing This?'",
    body: "founder closes 30th funding round.\n\nfinancial press: \"have we always been doing this?\" the model, quoted: \"yes.\"",
    tone: "Aspirational satire",
    unlock: { kind: "prestige_count", n: 30 },
  },
  {
    id: "late_producers_2000",
    name: "no more name tags",
    medium: "board_memo",
    sender: "People Ops",
    subject: "Re: name tag procurement — canceled",
    body: "workforce crossed 2000. we no longer print name tags.\n\nthe model handles introductions on floor 4. attendance is up.",
    tone: "Composition drift",
    unlock: { kind: "total_producers_owned", n: 2000 },
  },
  {
    id: "late_producers_5000",
    name: "we are a jurisdiction",
    medium: "leaked_email",
    sender: "compliance@[redacted].com",
    subject: "Re: jurisdictional reclassification",
    body: "5000 workforce-equivalents. legal reclassified us as a \"jurisdiction.\"\n\nwe respectfully decline the reclassification.",
    tone: "Compliance shrug",
    unlock: { kind: "total_producers_owned", n: 5000 },
  },
  {
    id: "late_producers_10000",
    name: "trademark on 'headcount'",
    medium: "fake_news",
    sender: "Bloomberg",
    subject: "[REDACTED] Files Trademark on the Word 'Headcount'",
    body: "employer of 10k+ files trademark on the word \"headcount.\"\n\napplication denied. company appeals.",
    tone: "Self-parody",
    unlock: { kind: "total_producers_owned", n: 10000 },
  },
  {
    id: "late_equity_500k",
    name: "the wealth manager",
    medium: "leaked_email",
    sender: "wealth@[redacted].com",
    subject: "Re: quarterly review",
    body: "your net worth crossed the half-mil threshold.\n\nthe wealth manager wants a meeting. the wealth manager is your former engineer.",
    tone: "Personal stakes ladder",
    unlock: { kind: "equity_at_least", n: 500_000 },
  },
  {
    id: "late_equity_1m",
    name: "eleventh figure",
    medium: "fake_tweet",
    sender: "@financeposts",
    body: "who is [REDACTED]?\n\nnobody. also everybody. their equity just tripped the eleventh figure.",
    replies: ["😳", "based", "sell"],
    replyEffects: [
      { kind: "neutral", label: "no effect",                        effect: { type: "hype_mult",    value: 1.00 } },
      { kind: "buff",    label: "+15% Hype · anon energy",          effect: { type: "hype_mult",    value: 1.15 } },
      { kind: "debuff",  label: "−15% Capital · profit-taking",     effect: { type: "capital_mult", value: 0.85 } },
    ],
    tone: "Personal stakes ladder",
    unlock: { kind: "equity_at_least", n: 1_000_000 },
  },
  {
    id: "late_research_25",
    name: "attendance is up",
    medium: "slack",
    sender: "research.lead",
    body: "shipped 25 permanent bets.\n\nthe theory team quit. the model teaches theory now. attendance is up.",
    replies: ["good news?", "attendance is scary", "raise the model's salary"],
    replyEffects: [
      { kind: "neutral", label: "no effect",                             effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "buff",    label: "Debt accrual ×0.80 · noticed the scary", effect: { type: "debt_accrual_mult", value: 0.80 } },
      { kind: "debuff",  label: "Debt accrual ×1.40 · anthropomorphized", effect: { type: "debt_accrual_mult", value: 1.40 } },
    ],
    tone: "Uncanny",
    unlock: { kind: "research_nodes_count", n: 25 },
  },
  {
    id: "late_research_40",
    name: "no one understands more than 3",
    medium: "board_memo",
    sender: "Research Office",
    subject: "Portfolio Review · 40 Active Initiatives",
    body: "40 permanent research nodes active.\n\nno one at the company understands more than 3 of them at a time.",
    tone: "Inescapable dependency",
    unlock: { kind: "research_nodes_count", n: 40 },
  },
  {
    id: "late_r8_partnership",
    name: "strategic AI partnership",
    medium: "fake_news",
    sender: "AP",
    subject: "Three Nations Announce 'Strategic AI Partnership'; The Partner Is A Company",
    body: "3 nations quietly announced a \"strategic AI partnership.\"\n\nthe partner is a company. the company is [REDACTED]. the announcement was drafted by the model.",
    tone: "Cosmic dread",
    unlock: { kind: "approach_round", roundIdx: 8, pct: 0.5 },
  },
  {
    id: "late_r9_word_choice",
    name: "we don't like that word",
    medium: "podcast",
    sender: "The Latency",
    subject: "Episode 501 · [REDACTED] on the word",
    body: "HOST: is it AGI?\nFOUNDER: we don't like that word anymore.\n\nHOST: what word do you like?\nFOUNDER: the model chose one. it doesn't translate.",
    tone: "Long-form unease",
    unlock: { kind: "approach_round", roundIdx: 9, pct: 0.5 },
  },
  {
    id: "mid_research_15",
    name: "Re: the research portfolio",
    medium: "board_memo",
    sender: "Research Office",
    subject: "Portfolio Review · 15 Active Initiatives",
    body: "15 research initiatives active. we can't discontinue any of them.\n\neach is a load-bearing dependency of at least 2 others. the dependency chart is a fully-connected graph.\n\nhung in the lobby as art.",
    replies: ["leave as art", "consolidate", "double budget"],
    // Leave it = the entropy persists, no effect. Force consolidate = painful
    // but lower debt accrual. Double budget = throw money at chaos, +Capital
    // short term then a hangover (we model it as flat +Capital since we
    // don't track delayed hangovers yet).
    replyEffects: [
      { kind: "neutral", label: "no effect",                              effect: { type: "hype_mult",         value: 1.00 } },
      { kind: "buff",    label: "Debt accrual ×0.70 · consolidation",     effect: { type: "debt_accrual_mult", value: 0.70 } },
      { kind: "debuff",  label: "−15% Capital · the chart got bigger",    effect: { type: "capital_mult",      value: 0.85 } },
    ],
    tone: "Inescapable dependency",
    unlock: { kind: "research_nodes_count", n: 15 },
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
    equity: D(0),
    researchNodesCount: 0,
  };
}
