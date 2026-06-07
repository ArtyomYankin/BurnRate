import { D, Decimal, ZERO } from "./decimal";
import { Allocation, ChainId, PersistentState, RunState } from "./types";
import {
  activeEffectForDebtEvent,
  detectThresholdsCrossed,
  getDebtEvent,
} from "./debtEvents";
import { aggregateActiveEffects, mergeEffects, pruneExpired } from "./effects";
import {
  AUTONOMOUS_AGENT,
  COST_DEF_BY_ID,
  producersForChain,
} from "./producers";
import { aggregateSprintEffects } from "./sprintUpgrades";
import { NO_RESEARCH_EFFECTS, ResearchEffects } from "./research";
import { getRound } from "./rounds";

// --------------------------- ALLOCATE BEAT --------------------------------
// GDD §4 Beat 2 + §9. Incoming tokens get split across four departments each
// tick, producing derivative currencies. Tokens themselves still accumulate
// (they're what prestige is measured against); allocation generates Capital,
// Hype, Research Points, and pays down / accrues Alignment Debt on top.

// Default split: Product-heavy so Capital flows fast in M+1 alpha and the
// player can buy producers. Safety at 15% covers the no-debt-accrual floor of
// 10% in the GDD §9 formula. Tunable; player can change immediately.
export const DEFAULT_ALLOCATION: Allocation = {
  rd: 0.10,
  product: 0.60,
  marketing: 0.15,
  safety: 0.15,
};

// Conversion rates from "share of tokens/sec" to derivative currencies.
// Calibrated so the M+1 feel is roughly:
//   - Product 60% ⇒ Capital flows at ~0.6× the token rate (close to prior 1:1 placeholder)
//   - Marketing 15% ⇒ Hype gains a few units per minute early
//   - R&D 10% ⇒ ~6 RP/min at 1 tok/s (tier-1 research nodes cost 15 RP — reachable)
// Halved from 1.0 — capital was racing ahead of the producer-cost curve from
// round 4+ even after the prestige-bonus cut, making top-tier producers
// spammable. 0.5 keeps the spend-vs-earn tension that powers the loop.
const CAPITAL_PER_TOKEN = 0.5;
const HYPE_PER_TOKEN = 0.05;
const RP_PER_TOKEN = 0.01;

// GDD §9: debt_per_hour = max(0, 0.10 - safety_budget) * 25
// We convert /h to /s and also use the surplus above 10% to PAY DOWN existing
// debt at the symmetric rate (GDD says Safety pays debt down; doesn't fix a
// constant, so mirroring the accrual constant is the simple, balanced choice).
const SAFETY_FLOOR = 0.10;
const DEBT_K_PER_HOUR = 25;
const SECS_PER_HOUR = 3600;

// GDD §5 AGI arc: from the Acquisition round (idx 7) on, alignment debt
// ACCRUES faster — a more capable model makes safety neglect compound harder.
// Pay-down is untouched; only the accrual side escalates. Matches the round
// where the Autonomous Agent unlocks (AUTONOMOUS_AGENT.unlockRoundIdx).
export const AGI_ARC_START_ROUND = 7;
const AGI_DEBT_ESCALATION_PER_ROUND = 0.5;

/**
 * Accrual multiplier for the AGI arc. ×1 for all pre-arc rounds, then climbs
 * +0.5 per round: round 7 → ×1.5, round 8 → ×2.0, … round 11 → ×3.5.
 */
export function agiArcDebtMultiplier(roundIdx: number): number {
  if (roundIdx < AGI_ARC_START_ROUND) return 1;
  return 1 + (roundIdx - (AGI_ARC_START_ROUND - 1)) * AGI_DEBT_ESCALATION_PER_ROUND;
}

export function normalizeAllocation(a: Allocation): Allocation {
  const sum = a.rd + a.product + a.marketing + a.safety;
  if (sum <= 0) return { ...DEFAULT_ALLOCATION };
  return {
    rd:        a.rd / sum,
    product:   a.product / sum,
    marketing: a.marketing / sum,
    safety:    a.safety / sum,
  };
}

/**
 * GDD §6: cost to buy `count` more producers of a tier, given `owned` are owned.
 * Geometric series: base * mult^owned * (mult^count - 1) / (mult - 1)
 */
export function producerBatchCost(
  def: { baseCostCapital: number; costMult: number },
  owned: number,
  count = 1
): Decimal {
  if (count <= 0) return ZERO;
  const mult = def.costMult;
  const base = def.baseCostCapital;
  if (mult === 1) {
    return D(base).mul(count).mul(D(mult).pow(owned));
  }
  const head = D(base).mul(D(mult).pow(owned));
  const series = D(mult).pow(count).sub(1).div(mult - 1);
  return head.mul(series);
}

/**
 * GDD §6: cost of the *next* single producer of a tier.
 */
export function nextProducerCost(
  def: { baseCostCapital: number; costMult: number },
  owned: number
): Decimal {
  return D(def.baseCostCapital).mul(D(def.costMult).pow(owned));
}

/**
 * GDD §6: per-producer upgrade multipliers, unlocked at 10 / 50 / 100 owned.
 * Stack multiplicatively to a ceiling of ×64 (= ×2 × ×4 × ×8). For M+1 the
 * upgrades auto-apply at threshold; the GDD's "10× cumulative cost" gate lands
 * with the Allocate beat (when Capital has a real sink besides producers).
 */
export function upgradeMultiplier(owned: number): number {
  let m = 1;
  if (owned >= 10)  m *= 2;
  if (owned >= 50)  m *= 4;
  if (owned >= 100) m *= 8;
  return m;
}

/** Which discrete upgrade tier (0..3) is currently active for an owned count. */
export function upgradeTier(owned: number): 0 | 1 | 2 | 3 {
  if (owned >= 100) return 3;
  if (owned >= 50)  return 2;
  if (owned >= 10)  return 1;
  return 0;
}

/**
 * Aggregate supply for one chain — sum of (baseOutput * owned * upgradeMult)
 * across that chain's producers, then multiplied by any research-tree
 * `chain_supply_mult` effect for that chain.
 */
export function chainSupply(
  chain: ChainId,
  run: RunState,
  effects: ResearchEffects = NO_RESEARCH_EFFECTS
): Decimal {
  let acc: Decimal = ZERO;
  for (const def of producersForChain(chain)) {
    const n = run.producersOwned[def.id] ?? 0;
    if (n <= 0) continue;
    const upgradeMult = upgradeMultiplier(n);
    acc = acc.add(D(def.baseOutputPerSec).mul(n).mul(upgradeMult));
  }
  const researchMult = effects.chainSupplyMult[chain] ?? 1;
  return acc.mul(researchMult);
}

export interface PipelineSupplies {
  engineers: Decimal;
  gpu: Decimal;
  data: Decimal;
  energy: Decimal;
}

export function allChainSupplies(
  run: RunState,
  effects: ResearchEffects = NO_RESEARCH_EFFECTS
): PipelineSupplies {
  return {
    engineers: chainSupply("engineers", run, effects),
    gpu:       chainSupply("gpu", run, effects),
    data:      chainSupply("data", run, effects),
    energy:    chainSupply("energy", run, effects),
  };
}

/**
 * Engineer chain's scaling exponent on the multiplier side of the Liebig
 * pipeline. GDD §7 originally specified 0.5 (sqrt), but at the typical
 * "parity" state — equal counts of every tier-0 producer — sqrt deflates
 * Engineers so hard that their marginal ROI per dollar is always lower than
 * any flow chain's, and the whole branch turns into decoration.
 *
 * 0.8 preserves the sub-linear "9 women, 1 month" intent (still diminishing
 * returns on headcount).
 */
export const ENGINEER_SCALING_EXPONENT = 0.8;

/**
 * Engineer multiplier, FLOORED AT 1.0 for any positive supply.
 *
 * Why the floor: at the fresh-start state (1 Intern → eng_supply 0.10), a raw
 * 0.10^0.8 = 0.158 multiplier deflated production ~6× and made the first
 * purchase take minutes. A multiplier below 1.0 also reads as nonsense —
 * "having one engineer makes me produce LESS?" The floor means engineers
 * never penalize; they only ever add, once you push supply past 1.0
 * (≈10 tier-0 Interns). Below that the curve is flat 1.0 — the player is
 * meant to invest in the flow chains first (raising min), then engineers.
 *
 * The floor only touches eng_supply < 1.0, so late-game pacing (hundreds of
 * engineers) is byte-for-byte unchanged from the pure-power curve.
 */
export function engineerMultiplier(engSupply: Decimal): Decimal {
  if (engSupply.lte(0)) return ZERO; // GDD §7: no engineers ⇒ no tokens
  return Decimal.max(1, engSupply.pow(ENGINEER_SCALING_EXPONENT));
}

/**
 * GDD §7: tokens_per_sec = min(gpu, data, energy) * engMult(engineers) * tokensMult.
 *
 * Engineers contribute as a MULTIPLIER (sub-linear scaling — diminishing
 * returns on headcount) while the other three chains are flows bottlenecked
 * by their minimum (Liebig's Law of the Minimum). Unbalanced builds stall.
 *
 * `tokensMult` is the aggregated research-tree multiplier (1.0 by default).
 * Chain-supply multipliers are baked into allChainSupplies before getting here.
 */
export function tokensPerSec(
  run: RunState,
  effects: ResearchEffects = NO_RESEARCH_EFFECTS,
  persistent?: Pick<PersistentState, "equity">
): Decimal {
  const s = allChainSupplies(run, effects);
  // We want "no engineers => no tokens" per GDD §7.
  if (s.engineers.lte(0)) return ZERO;
  const bottleneck = Decimal.min(s.gpu, Decimal.min(s.data, s.energy));
  if (bottleneck.lte(0)) return ZERO;
  // GDD §7 specifies strict Liebig (pure min). In practice that produced a
  // "buying a non-bottleneck producer changes nothing" UX which felt broken.
  // Soften it: 80% min + 20% arithmetic mean. The bottleneck still dominates
  // (strategy preserved — balanced builds beat unbalanced), but every buy
  // gives some visible movement so the loop reads as "numbers go up".
  const avg = s.gpu.add(s.data).add(s.energy).div(3);
  const effectiveFlow = bottleneck.mul(0.8).add(avg.mul(0.2));
  // Per-run RP-bought sprint upgrades stack on top of research multipliers.
  const sprintTokensMult = aggregateSprintEffects(run.sprintUpgradesUnlocked).tokensMult;
  return effectiveFlow
    .mul(engineerMultiplier(s.engineers))
    .mul(effects.tokensMult)
    .mul(autonomousAgentMult(run))
    .mul(sprintTokensMult)
    .mul(prestigeBonusMult(run.fundingRoundIdx))
    .mul(equityFlywheelMult(persistent));
}

/**
 * Persistent permanent multiplier from closed funding rounds. Each round
 * closed grants an `equityMult` (from the round def — 1.0 at Seed, 86.7 at
 * AGI Singularity). We compound the multipliers of all PREVIOUSLY closed
 * rounds — i.e., reaching round N means rounds 0..N-1 were closed.
 *
 * Why this exists: stops the "bar visibly fills" Pillar-4 violation at
 * round 4+. Without it, producer-base outputs scale ~×5/tier but round
 * thresholds scale ×1e10/round; players bought every top-tier producer
 * and saw zero bar movement. With this, each prestige permanently buffs
 * production, so the *next* round's bar moves visibly during each session.
 */
export function prestigeBonusMult(currentRoundIdx: number): Decimal {
  // Tame geometric curve. The previous formula compounded the round-def
  // `equityMult` of every closed round, which hit ×11 at round 4 and ×5000 by
  // round 7 — well beyond what the cost curve could absorb (capital flooded,
  // top-tier producers became spammable). 1.3^N keeps the prestige reward
  // meaningful (round 4 ×2.9, round 11 ×18) without overwhelming the loop.
  return D(1.3).pow(currentRoundIdx);
}

/**
 * Equity-based flywheel. The more lifetime equity the player has banked,
 * the bigger this multiplier — log-scale so it never breaks late-game
 * (1k equity = ×4, 1M = ×7, 1B = ×10, etc.). Encourages overshoot before
 * prestige (sqrt-equity formula already rewards that, this amplifies it).
 */
export function equityFlywheelMult(persistent?: Pick<PersistentState, "equity">): Decimal {
  if (!persistent) return D(1);
  const eq = D(persistent.equity);
  if (eq.lte(1)) return D(1);
  // Halved from the first cut: eq=1k → ×2.5, eq=1M → ×4, eq=1e12 → ×7.
  // Capital was racing too far ahead of producer costs; this slows it.
  const e = eq.toNumber ? eq.toNumber() : Number(eq.toString());
  return D(1 + Math.log10(Math.max(1, e) + 1) / 2);
}

/**
 * GDD §6 AGI arc: self-improving-AI flywheel. Each Autonomous Agent owned
 * multiplies TOTAL tokens/sec by `multPerUnit`, stacking exponentially with
 * the count owned. Returns ×1 when none are owned, so it's a no-op for the
 * entire pre-AGI game.
 */
export function autonomousAgentMult(run: RunState): Decimal {
  const owned = run.producersOwned[AUTONOMOUS_AGENT.id] ?? 0;
  if (owned <= 0) return D(1);
  return D(AUTONOMOUS_AGENT.multPerUnit).pow(owned);
}

/**
 * Which chain is the bottleneck for current tokens/sec? Returns the chain with
 * the smallest supply among {gpu, data, energy} — engineers can't bottleneck
 * because they're a multiplier, not a flow. Returns null if any of the three
 * are zero AND engineers are zero (no production at all).
 *
 * Caller can use this to render the §13 tension-red accent on the limiting card.
 */
export function bottleneckChain(
  run: RunState,
  effects: ResearchEffects = NO_RESEARCH_EFFECTS
): ChainId | null {
  const s = allChainSupplies(run, effects);
  if (s.engineers.lte(0)) return "engineers"; // zero-engineers also stalls
  const choices: { id: ChainId; supply: Decimal }[] = [
    { id: "gpu", supply: s.gpu },
    { id: "data", supply: s.data },
    { id: "energy", supply: s.energy },
  ];
  // The "limiting" chain is the smallest — even if all three are positive, the
  // min is still meaningfully the cap.
  let min = choices[0];
  for (const c of choices) if (c.supply.lt(min.supply)) min = c;
  return min.id;
}

/**
 * GDD §9: signed debt rate per second given the current Safety budget.
 *   safety_pct <  0.10 → accrual (positive return value)
 *   safety_pct == 0.10 → neutral (returns 0)
 *   safety_pct >  0.10 → pay-down (negative return value)
 *
 * Research-tree `debt_accrual_mult` (<1 from Safety branch nodes) scales the
 * accrual side only — pay-down stays on its symmetric rate so over-investing
 * in Safety still helps the same amount, but neglect costs less if you've
 * researched mitigation.
 */
export function debtRatePerSec(
  safetyPct: number,
  effects: ResearchEffects = NO_RESEARCH_EFFECTS,
  roundIdx = 0
): number {
  const offset = SAFETY_FLOOR - safetyPct;
  const base = (offset * DEBT_K_PER_HOUR) / SECS_PER_HOUR;
  if (base > 0) {
    return base * effects.debtAccrualMult * agiArcDebtMultiplier(roundIdx);
  }
  return base;
}

/**
 * Apply `dtSeconds` of production to (run, persistent). Returns NEW objects.
 *
 * - Tokens accumulate at the full pipeline rate (the visible counter, what
 *   prestige is measured against).
 * - Each tick those incoming tokens ALSO seed derivative currencies in
 *   proportion to the allocation: Capital (Product), Hype (Marketing),
 *   Research Points (R&D).
 * - Alignment Debt accrues or pays down per GDD §9 based on Safety allocation
 *   independently of token production — neglect costs you whether you're
 *   producing or not.
 */
/**
 * Tick the simulation forward by `dtSeconds`. Returns NEW (run, persistent).
 *
 * Research effects (persistent multipliers from the tree) and active effects
 * (temporary multipliers from Training Runs etc.) get merged into a single
 * effect bundle for the tick. Expired active effects are pruned out of the
 * run state — that's the single point where active effects disappear.
 *
 * `now` is the wall-clock ms for the END of the dt window. Defaults to
 * Date.now() so callers don't have to thread it; tests pin it.
 */
/**
 * Tick the simulation forward. Returns NEW (run, persistent) AND a list of
 * debt-threshold events that fired this tick (so the UI layer can show their
 * modals). Threshold events are detected by comparing prev vs new debt; each
 * threshold fires at most once per save (tracked in persistent.firedDebtThresholds).
 *
 * When an event fires, its active effect is appended to run.activeEffects,
 * and its threshold is appended to persistent.firedDebtThresholds in the
 * same tick — so it can't double-fire even on the next dt.
 */
export function tickRun(
  run: RunState,
  persistent: PersistentState,
  dtSeconds: number,
  researchEffects: ResearchEffects = NO_RESEARCH_EFFECTS,
  now: number = Date.now()
): {
  run: RunState;
  persistent: PersistentState;
  firedThresholds: number[];
} {
  if (dtSeconds <= 0) return { run, persistent, firedThresholds: [] };

  // Merge research (perma) + active (temp) effects. Multiplicative stacking
  // per GDD §7 — sub-1 multipliers on the debt side compound downward too.
  const activeEffects = aggregateActiveEffects(run.activeEffects, now);
  const effects = mergeEffects(researchEffects, activeEffects);
  // Per-run RP-bought sprint upgrades (GDD §4 Beat 2): stack multiplicatively
  // alongside research + active. Already folded into tokensPerSec; here we
  // apply the capital/hype/rp mults on the derivative-currency seeding step.
  const sprintFx = aggregateSprintEffects(run.sprintUpgradesUnlocked);

  const alloc = run.allocation;
  const rate = tokensPerSec(run, effects, persistent);
  const produced = rate.mul(dtSeconds);

  const nextTokens   = D(run.tokens).add(produced);
  const nextCapital  = D(run.capital).add(
    produced.mul(alloc.product).mul(CAPITAL_PER_TOKEN)
      .mul(effects.capitalMult).mul(sprintFx.capitalMult)
  );
  const nextHype     = D(run.hype).add(
    produced.mul(alloc.marketing).mul(HYPE_PER_TOKEN)
      .mul(effects.hypeMult).mul(sprintFx.hypeMult)
  );
  const nextRP       = D(run.researchPoints).add(
    produced.mul(alloc.rd).mul(RP_PER_TOKEN)
      .mul(effects.rpMult).mul(sprintFx.rpMult)
  );

  // Alignment debt: accrues whenever Safety < 10%. Capped at zero.
  const prevDebt = D(persistent.alignmentDebt);
  const debtDelta = debtRatePerSec(alloc.safety, effects, run.fundingRoundIdx) * dtSeconds;
  const nextDebt = Decimal.max(0, prevDebt.add(debtDelta));

  // Threshold events: compare prev vs new debt against the unfired thresholds.
  const firedThresholds = detectThresholdsCrossed(
    prevDebt.toNumber(),
    nextDebt.toNumber(),
    persistent.firedDebtThresholds
  );

  // Build active effects for each fired threshold and append to run.
  let newActiveEffects = pruneExpired(run.activeEffects, now);
  let activeChanged = newActiveEffects.length !== run.activeEffects.length;
  for (const t of firedThresholds) {
    const ev = getDebtEvent(t);
    if (!ev) continue;
    const eff = activeEffectForDebtEvent(ev, now);
    if (eff) {
      newActiveEffects = [...newActiveEffects, eff];
      activeChanged = true;
    }
  }

  const nextFiredThresholds =
    firedThresholds.length === 0
      ? persistent.firedDebtThresholds
      : [...persistent.firedDebtThresholds, ...firedThresholds];

  return {
    run: {
      ...run,
      tokens:         nextTokens.toString(),
      capital:        nextCapital.toString(),
      hype:           nextHype.toString(),
      researchPoints: nextRP.toString(),
      activeEffects:  activeChanged ? newActiveEffects : run.activeEffects,
    },
    persistent: {
      ...persistent,
      alignmentDebt:       nextDebt.toString(),
      firedDebtThresholds: nextFiredThresholds,
    },
    firedThresholds,
  };
}

/**
 * Attempt to buy `count` of a producer tier. Returns the new run state and a
 * `bought` count. Strict batch: either the whole batch fits or nothing happens.
 */
export function buyProducer(
  run: RunState,
  producerId: string,
  count = 1
): { run: RunState; bought: number; spent: Decimal } {
  const def = COST_DEF_BY_ID[producerId];
  if (!def) return { run, bought: 0, spent: ZERO };
  const owned = run.producersOwned[producerId] ?? 0;
  const cost = producerBatchCost(def, owned, count);
  const capital = D(run.capital);
  if (capital.lt(cost)) return { run, bought: 0, spent: ZERO };
  const nextCapital = capital.sub(cost);
  return {
    run: {
      ...run,
      capital: nextCapital.toString(),
      producersOwned: {
        ...run.producersOwned,
        [producerId]: owned + count,
      },
    },
    bought: count,
    spent: cost,
  };
}

/**
 * GDD §5.2: round threshold in Tokens. Stored as log10 to dodge Decimal in defs.
 */
export function roundThreshold(idx: number): Decimal {
  const r = getRound(idx);
  return D(10).pow(r.tokenThresholdLog10);
}

// ─── Hype → prestige discount (GDD §4 Beat 2 + §7 currency sink) ────────
// Marketing → Hype → "easier funding rounds": Hype shortens the next
// prestige by reducing the EFFECTIVE token threshold. Diminishing-returns
// curve so dumping Hype never trivializes a round; capped at 50% off.
//
//   discount = min(0.5, hype / (hype + 0.05 × baseThreshold))
//
// At default play (Marketing 15%) you'll see a small single-digit discount.
// Going Marketing-heavy (40-50%) pushes it toward 30-50%. Hype itself
// resets on prestige (GDD §5 prestige table), so the credit can't carry over.
const HYPE_PIVOT_FRACTION = 0.05;
const HYPE_MAX_DISCOUNT = 0.5;

export function hypeThresholdDiscount(
  roundIdx: number,
  hype: Decimal | string | number,
): number {
  const h = D(hype);
  if (h.lte(0)) return 0;
  const base = roundThreshold(roundIdx);
  const pivot = base.mul(HYPE_PIVOT_FRACTION);
  const raw = h.div(h.add(pivot)).toNumber();
  return Math.min(HYPE_MAX_DISCOUNT, raw);
}

export function effectiveRoundThreshold(
  roundIdx: number,
  hype: Decimal | string | number,
): Decimal {
  const base = roundThreshold(roundIdx);
  const discount = hypeThresholdDiscount(roundIdx, hype);
  return base.mul(1 - discount);
}

export function canPrestige(run: RunState): boolean {
  return D(run.tokens).gte(effectiveRoundThreshold(run.fundingRoundIdx, run.hype));
}

/**
 * GDD §8: Equity_gained = floor(150 * sqrt(tokens_total / threshold) * round_mult).
 * The "threshold" here is the EFFECTIVE one (Hype-discounted) — so a Hype-heavy
 * close still gets full base Equity, and over-grinding past the discounted
 * threshold gives the same sqrt overshoot bonus as before.
 */
export function equityFromPrestige(run: RunState): Decimal {
  const eff = effectiveRoundThreshold(run.fundingRoundIdx, run.hype);
  const ratio = D(run.tokens).div(eff);
  if (ratio.lt(1)) return ZERO;
  const mult = getRound(run.fundingRoundIdx).equityMult;
  return ratio.sqrt().mul(150).mul(mult).floor();
}

/**
 * Cap offline production by the current round's offline cap (hours).
 */
export function clampOfflineDt(dtSeconds: number, roundIdx: number): number {
  const capSeconds = getRound(roundIdx).offlineCapHours * 3600;
  return Math.max(0, Math.min(dtSeconds, capSeconds));
}

// GDD §4 pre-buys an Intern; with the Liebig pipeline we need ≥1 of each
// chain's lowest tier or tokens/sec is zero by design. The starter is
// asymmetric on purpose: Engineers carry a sqrt multiplier, the other three
// chains are linear flow inputs, so equal counts make Engineers feel
// over-supplied and irrelevant to buy.
//
// Marginal-ROI break-even is eng_supply < 0.44 × min_supply. With 1 Intern
// (0.10) and 3 of each flow tier-0 (min = 0.45), eng = 0.10 sits just under
// 0.20 (= 0.44 × 0.45) — so the first Engineer purchase actually wins. After
// one more Engineer, the math swings to favor flow chains again, which is
// exactly the back-and-forth GDD §6 wants.
export const STARTER_ENGINEERS = 1;
export const STARTER_FLOW = 3;

/**
 * Fresh starting run-state. Identical every time — research-tree multipliers
 * (purchased with persistent Equity) are what compound across prestiges.
 */
// Seed capital so the player can make their first 1–2 purchases the instant
// they open the game, instead of staring at a slow capital trickle. Re-granted
// every prestige (freshRunState runs on round close) so each round opens with
// a little buying power rather than a dead trickle. Negligible against
// late-game capital magnitudes.
//
// 90 covers: Intern (15) + 4th GPU (~61) + small change. Tuned so the
// guided tutorial (hire engineer → buy GPU) flows without a capital wait.
export const STARTER_CAPITAL = 90;

export function freshRunState(): RunState {
  return {
    fundingRoundIdx: 0,
    tokens: ZERO.toString(),
    capital: D(STARTER_CAPITAL).toString(),
    hype: ZERO.toString(),
    researchPoints: ZERO.toString(),
    allocation: { ...DEFAULT_ALLOCATION },
    producersOwned: {
      intern: STARTER_ENGINEERS,
      single_h100: STARTER_FLOW,
      common_crawl: STARTER_FLOW,
      office_grid: STARTER_FLOW,
    },
    activeEffects: [],
    trainingPity: 0,
    sprintUpgradesUnlocked: [],
  };
}
