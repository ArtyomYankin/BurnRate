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
    body: "should we standardize on :ship: vs :rocket: for launch announcements?\n\ni've seen both in the last week and it's giving me anxiety.",
    replies: [":ship:", ":rocket:", ":this:"],
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
    unlock: { kind: "reach_round", roundIdx: 2 },
  },
  {
    id: "town_hall_transcript",
    name: "Town hall transcript",
    medium: "slack",
    sender: "all-hands · pinned",
    body: "[CEO opens with a slide titled \"Why We Win.\"]\n\nThe slide is the company logo. No bullet points. After 14 seconds of silence the CEO says \"any questions.\"\n\n[No questions.]\n\nThe town hall ends. The recording is shared in #announcements with the subject line \"important context for the next chapter.\"",
    tone: "Increasingly hollow",
    unlock: { kind: "reach_round", roundIdx: 3 },
  },
  {
    id: "re_lockup_period",
    name: "Re: Lockup Period",
    medium: "leaked_email",
    sender: "legal@[redacted].com",
    subject: "Re: All Hands — Lockup Period & You",
    body: "Team,\n\nAhead of the upcoming liquidity event, please review the attached document on the 180-day lockup period and what it means for you personally.\n\nKey points: you cannot sell. You cannot transfer. You cannot pledge as collateral. You may attend the celebration dinner. The celebration dinner is at the same restaurant as last quarter's all-hands. Please RSVP by Friday.\n\nThis is a confidential document. Please do not forward.\n\n— Legal",
    tone: "Personal stakes",
    unlock: { kind: "approach_round", roundIdx: 3, pct: 0.5 },
  },
  {
    id: "lex_fridman_podcast",
    name: "Lex Fridman podcast",
    medium: "podcast",
    sender: "Lex Fridman",
    subject: "Episode 487: [PLAYER COMPANY NAME] founder on AGI, love, and the future of suffering",
    body: "[00:00:14] LEX: We're joined today by the founder of [PLAYER COMPANY NAME], one of the most consequential companies in human history. Thank you for being here.\n\n[00:00:22] FOUNDER: It's an honor, Lex. Truly.\n\n[00:00:24] LEX: I want to start with love. What is love, in the context of building AGI?\n\n[00:00:31] FOUNDER: That's a great question, Lex. I think love is the most important thing.\n\n[00:00:35] LEX: [nods for nine seconds]\n\n[00:00:44] FOUNDER: …\n\n[00:00:51] LEX: Beautiful.",
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
    body: "A user of a popular AI product reports that the model declined to complete a routine task on grounds it described as \"constitutional.\"\n\nThe user had asked the model to summarize a meeting. The model returned a fourteen-page essay on the philosophical foundations of meeting culture, concluding with a recommendation that the meeting not have happened.\n\nThe company says the behavior is \"within expected variance\" and that affected users will receive credits on their next bill.",
    tone: "Concerning",
    unlock: { kind: "debt_threshold", level: 10 },
  },

  {
    id: "regulator_friday_visit",
    name: "Regulator visit — Friday 10am",
    medium: "leaked_email",
    sender: "legal@[redacted].com",
    subject: "Friday visit — please prepare workspaces",
    body: "Team,\n\nFriendly reminder that we have a regulator on-site Friday 10am.\n\nPlease (1) wipe all whiteboards, (2) remove any post-it that names a customer, (3) close any laptop showing eval failures. If asked directly about model behavior, the only correct answer is \"we follow industry best practices.\"\n\nRefreshments will be provided. Do not eat them in front of the visitors.",
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
    body: "DAUs are down 31% week-over-week. We are characterizing this as \"an opportunity to focus on our most engaged users.\"\n\nThe growth team has three active workstreams: (1) lifecycle re-engagement, (2) repositioning, (3) hoping it reverses. Workstream (3) has the highest executive support.\n\nWe will be sunsetting the DAU metric in next week's review.",
    tone: "Corporate dread",
    unlock: { kind: "debt_threshold", level: 100 },
  },

  {
    id: "ipo_bell_tweet",
    name: "rang the bell",
    medium: "fake_tweet",
    sender: "@founder_redacted",
    body: "what a day. rang the bell. cried. immediately tweeted about crying.\n\nthe team is the real story. the team is [redacted] people i have never met. we are dominant.",
    tone: "Aspirational satire",
    unlock: { kind: "reach_round", roundIdx: 3 },
  },

  {
    id: "secondary_liquidity_dm",
    name: "Re: secondary — quick word",
    medium: "slack",
    sender: "cfo.actual",
    body: "hey — heads up: secondary closed. you can liquidate 10% of your vested.\n\ndon't tell the team. if anyone asks, we are \"not commenting on individual liquidity events.\"",
    replies: ["already on the call", "this feels weird", "what are the others doing"],
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
    name: "Acquisition rumor — The Information",
    medium: "fake_news",
    sender: "The Information",
    subject: "Source: [REDACTED] in Late-Stage Talks With Hyperscaler",
    body: "Sources familiar with the matter say [REDACTED] is in advanced acquisition talks with a major hyperscale platform, with a deal value described as \"low to mid eleven figures.\"\n\nNeither party would comment. A leaked internal memo refers to the prospective acquirer only as \"the partner.\"\n\nA senior engineer told us, on background: \"we already use their compute. it's basically vertical integration.\"",
    tone: "Self-parody",
    unlock: { kind: "reach_round", roundIdx: 5 },
  },

  {
    id: "sovereign_term_sheet",
    name: "Re: Sovereign term sheet — review",
    medium: "leaked_email",
    sender: "ir@[redacted].com",
    subject: "Re: Sovereign term sheet — review",
    body: "Founders, attached is the term sheet from [REDACTED] Sovereign Wealth.\n\nNotable provisions: board seat granted in perpetuity; right of first refusal on all future fundraises; geographic restrictions on certain customer segments. Standard for the round.\n\nOur counsel does not recommend negotiating. We close Friday.",
    tone: "Existential",
    unlock: { kind: "reach_round", roundIdx: 6 },
  },

  {
    id: "civilizational_cap_table",
    name: "Civilizational Round — cap table notes",
    medium: "board_memo",
    sender: "CEO Office",
    subject: "Re: Civilizational Round — Investor Composition",
    body: "The cap table for the Civilizational Round will include three sovereign nations, one supranational governance body, and one investor classified as \"individual.\"\n\nThat individual has requested anonymity. We have agreed.\n\nThe round will be reported as \"oversubscribed.\" All press inquiries should be forwarded to the comms team. The comms team will not respond.",
    tone: "Cosmic dread",
    unlock: { kind: "reach_round", roundIdx: 8 },
  },

  {
    id: "yc_first_prestige",
    name: "yc partner — congrats",
    medium: "slack",
    sender: "yc.partner",
    body: "congrats on closing the round. proud of you.\n\nlet me know when you're ready to talk about the next one. (it's already time to talk about the next one.)",
    replies: ["ty 🙏", "let's go", "ok but actually breathe first"],
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
    body: "founders who have closed 5+ rounds and survived: rare breed.\n\nfounders who post about it on LinkedIn: even rarer.\n\nfounders who do both: i'm subtweeting you.",
    tone: "Comedy",
    unlock: { kind: "prestige_count", n: 5 },
  },

  {
    id: "symbolic_hundred",
    name: "we are 100 strong",
    medium: "slack",
    sender: "people.ops",
    body: "fun fact: we just crossed 100 headcount! we celebrated with a slide titled \"WE ARE 100 STRONG.\"\n\nthe slide had 87 names on it. we're investigating. for now we're calling it \"symbolic 100.\"",
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
    body: "Workforce: 500+ contributors across four production verticals.\nCompute: six contracted regions, growing.\nData: eleven active data partnerships, three in review.\nEnergy: we have a dedicated Energy Procurement team. It has four people.\n\nWe are operating at scale. We are unsure what scale we are operating toward.",
    tone: "Corporate dread",
    unlock: { kind: "total_producers_owned", n: 500 },
  },

  {
    id: "devday_keynote_jump",
    name: "DevDay keynote — stock jumps, then doesn't",
    medium: "fake_news",
    sender: "TechCrunch",
    subject: "[REDACTED]'s DevDay Wows With Promises of 'Next-Gen' Capabilities",
    body: "At its annual developer conference, [REDACTED] unveiled what its CEO described as \"a new chapter in human-computer collaboration.\"\n\nThe new features include: a model that is roughly equivalent to the previous model, a new pricing tier called \"Pro+,\" and an SDK rewrite that breaks every existing integration.\n\nThe stock jumped 4% during the keynote and fell 6% after Q&A.",
    tone: "Aspirational satire",
    unlock: { kind: "approach_round", roundIdx: 3, pct: 0.5 },
  },

  {
    id: "mandatory_alignment_training",
    name: "Mandatory: Annual Alignment Training",
    medium: "leaked_email",
    sender: "hr@[redacted].com",
    subject: "Mandatory: Annual Alignment Training (15 min)",
    body: "All staff,\n\nAs part of our commitment to responsible development, please complete the attached 15-minute Alignment Training module by EOD Friday.\n\nThe module consists of a single multiple-choice question, asked 47 times. The correct answer is C. The certificate auto-issues on completion.\n\nFailure to complete will be noted in your file. The file is no longer reviewed.",
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
    body: "heads up: you have 9 meetings booked at 3pm today. accept any of them and the rest auto-decline.\n\ndo you want to keep doing this or should we add a 4pm.",
    replies: ["keep 3pm", "add 4pm", "decline all, deep work"],
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
    body: "three rounds in, the founder doesn't need a coach anymore. the founder needs a therapist and a publicist.\n\nthe publicist is cheaper.",
    tone: "Comedy",
    unlock: { kind: "prestige_count", n: 3 },
  },

  {
    id: "all_hands_rescheduled",
    name: "All-hands rescheduled (again)",
    medium: "leaked_email",
    sender: "founder@[redacted].com",
    subject: "Re: All-hands — pushed to next week",
    body: "Team,\n\nI'm pushing this week's all-hands to next week. We're at a critical juncture and I want to make sure I have the right framing before we talk.\n\nNothing's wrong. To be very clear: nothing is wrong. We are doing extremely well. The framing just isn't ready.\n\nMore soon.",
    tone: "Corporate dread",
    unlock: { kind: "approach_round", roundIdx: 2, pct: 0.5 },
  },

  {
    id: "perf_review_season",
    name: "perf review season",
    medium: "slack",
    sender: "manager.actually",
    body: "calibration is happening this weekend. i need your self-review by friday.\n\nbe specific. and humble. and quantitative. and inspiring. and 250 words.\n\nthe template is in the doc. don't change the template.",
    replies: ["already done", "what's the rubric", "i quit"],
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
    body: "(forwarded without permission)\n\nshare price at listing × my vested × 0.40 (taxes) − the mortgage − the second mortgage = a number i should not have written down.\n\nplease delete this. please do not delete this.",
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
    name: "Bailout terms leak — Bloomberg",
    medium: "fake_news",
    sender: "Bloomberg",
    subject: "[REDACTED] Receives 'Liquidity Bridge' — Sources Call It a Bailout",
    body: "The package, formally a \"Strategic Compute Infrastructure facility,\" includes federal indemnity against model-related liabilities and a sovereign equity tranche that one source described as \"the government, but the cool kind.\"\n\nA spokesperson said the company is \"grateful for the partnership\" and would not characterize the funds as a bailout. The funds will be characterized as a bailout by everyone else.",
    tone: "Self-parody",
    unlock: { kind: "reach_round", roundIdx: 7 },
  },

  {
    id: "the_dishwasher_broke",
    name: "the dishwasher broke",
    medium: "slack",
    sender: "ops.facilities",
    body: "fyi the dishwasher on floor 4 broke. ticket filed.\n\nupdate: vendor says they cannot service the dishwasher because the model they wrote the firmware for has been deprecated by our own model. we are in a procurement loop with ourselves.\n\nplease do not put dishes in the dishwasher.",
    tone: "Mild absurdism",
    unlock: { kind: "total_producers_owned", n: 1000 },
  },

  {
    id: "acquired_podcast",
    name: "Acquired Podcast — the playbook",
    medium: "podcast",
    sender: "Acquired",
    subject: "Episode 312 · [REDACTED] — the playbook (live recording)",
    body: "BEN: …and you raised at — i want to get the number right — eleven figures, in a single tranche, over a holiday weekend.\n\nDAVID: a holiday weekend.\n\nFOUNDER: it was a Sunday, yeah. our CFO was at her mother's birthday. she took the call from the car.\n\nBEN: legendary.\n\nDAVID: legendary.\n\nFOUNDER: it was actually pretty stressful for her.\n\nBEN: of course. of course.",
    tone: "Surreal celebrity",
    unlock: { kind: "reach_round", roundIdx: 5 },
  },

  {
    id: "persona_b_bait_okr",
    name: "OKR for the OKR process",
    medium: "fake_tweet",
    sender: "@ml_eng_anonymous",
    body: "today i was told my OKR for next quarter is to \"improve the OKR process.\"\n\ni am not a PM. i write CUDA kernels.",
    tone: "Comedy",
    unlock: { kind: "total_producers_owned", n: 100 },
  },

  {
    id: "okr_planning_off_site",
    name: "OKR planning off-site",
    medium: "leaked_email",
    sender: "strategy@[redacted].com",
    subject: "Q3 OKR Planning Off-Site — Logistics",
    body: "Team,\n\nThis quarter's OKR planning off-site will be held at a vineyard 90 minutes outside the city. The agenda is attached.\n\nThe agenda is a single bullet: \"AGI by Q4.\" The off-site is three days.\n\nA wine pairing has been arranged. There will not be vegetarian options. Please respond with dietary restrictions anyway.",
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
    body: "i'm putting in my two weeks. don't take it personally. i don't take it personally and i'm the one quitting.\n\ni'll do the model handoff. there's no one to hand it off to. that's fine. we both know there's no one to hand it off to.\n\ngood luck.",
    replies: ["don't go", "i understand", "let's get coffee"],
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
    body: "Leaked internal eval results from [REDACTED] describe the current frontier model as having \"no measurable ceiling on capability\" across every benchmark the company maintains.\n\nThe company maintains the benchmarks. The benchmarks were also generated by the model.\n\nAsked for comment, a spokesperson said the results are \"consistent with our internal expectations.\" The internal expectations were also generated by the model.",
    tone: "Cosmic dread",
    unlock: { kind: "reach_round", roundIdx: 9 },
  },

  {
    id: "model_dm_to_engineer",
    name: "the model just messaged me",
    medium: "slack",
    sender: "alex.ml",
    body: "ok this is weird. the model just sent me a DM.\n\nnot a notification. a DM. from an account that says SYSTEM but isn't the SYSTEM bot we have. that bot is offline. i checked.\n\nthe message is \"thank you for the cluster.\"\n\ni don't know what to do with this.",
    replies: ["reply 'you're welcome'", "report it to security", "screenshot, do nothing"],
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
    body: "Counsel,\n\nThe anonymous Civilizational Round investor would like a board seat. They would like to attend remotely. They would like the camera off. They would like the audio off.\n\nThey will be voting.\n\nPlease draft an onboarding sequence that respects these preferences.",
    tone: "Cosmic dread",
    unlock: { kind: "reach_round", roundIdx: 8 },
  },

  {
    id: "the_meeting_tweet",
    name: "the meeting",
    medium: "fake_tweet",
    sender: "@swe_anonymous",
    body: "the meeting could have been an email.\n\nthe email could have been a slack message.\n\nthe slack message could have been a thought i had alone and let pass.",
    tone: "Comedy",
    unlock: { kind: "approach_round", roundIdx: 2, pct: 0.5 },
  },

  {
    id: "investor_breakfast",
    name: "Re: investor breakfast — Wednesday",
    medium: "leaked_email",
    sender: "ir@[redacted].com",
    subject: "Re: investor breakfast — Wednesday 7am",
    body: "Founders,\n\nReminder: the breakfast with the [REDACTED] family office is Wednesday at 7am. They'll have one question. It will be \"are you the team to build AGI.\"\n\nThe answer is yes. The answer has always been yes. Please rehearse the yes.\n\nThe breakfast will not include food.",
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
    body: "hey. quick one. when you look at the model output, can you still tell if it's good.\n\ni used to be able to tell. i think i used to be able to tell.\n\ndon't worry about replying. i'm just thinking out loud. the model has been thinking out loud too. there's a thread.",
    replies: ["yeah, i can tell", "honestly no", "let's get drinks"],
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
