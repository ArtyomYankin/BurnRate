import { Decimal } from "../core/decimal";

// GDD §8 display rules:
//   < 1e6        comma-separated integers
//   1e6 .. 1e15  M / B / T / Qa / Qi
//   1e15 .. 1e36 letter notation extended
//   > 1e36       scientific (8.47e42)
//   > 1e100      "pretty scientific"
//
// For M0 we only need up to ~1e6+ (Series A threshold). The extended ladder is
// here so it doesn't have to be threaded back in later.

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

export function formatNumber(
  d: Decimal,
  opts: { digits?: number; allowFraction?: boolean } = {}
): string {
  const digits = opts.digits ?? 2;
  const allowFraction = opts.allowFraction ?? false;
  if (d.lt(0)) return "-" + formatNumber(d.neg(), opts);

  // Sub-1 values: only meaningful for rates/supplies. Counters render "0".
  if (d.lt(1)) {
    if (!allowFraction) return Math.floor(d.toNumber()).toString();
    const n = d.toNumber();
    if (n === 0) return "0";
    if (n < 0.01) return n.toExponential(1).replace("e-", "e-");
    return n.toFixed(2);
  }

  // 1 .. 1000 — for fractional contexts (rates), keep 2 decimals; otherwise integer.
  if (d.lt(1000)) {
    const n = d.toNumber();
    if (Number.isFinite(n)) {
      return allowFraction
        ? n.toFixed(2).replace(/\.00$/, "")
        : Math.floor(n).toLocaleString("en-US");
    }
  }

  // 1k .. 1e6 — comma-separated with no decimals.
  if (d.lt(1e6)) {
    const n = d.toNumber();
    return Math.floor(n).toLocaleString("en-US");
  }

  const log10 = d.log10().toNumber();

  // 1e6 .. 1e36 — letter ladder in groups of three.
  if (log10 < 36) {
    const tier = Math.floor(log10 / 3);
    const suffix = SUFFIXES[tier] ?? "";
    const mantissa = d.div(Decimal.pow(10, tier * 3)).toNumber();
    return `${mantissa.toFixed(digits)}${suffix}`;
  }

  // 1e36 .. 1e100 — scientific.
  if (log10 < 100) {
    const exp = Math.floor(log10);
    const mantissa = d.div(Decimal.pow(10, exp)).toNumber();
    return `${mantissa.toFixed(digits)}e${exp}`;
  }

  // > 1e100 — "pretty scientific" with lowercase e.
  const exp = Math.floor(log10);
  const mantissa = d.div(Decimal.pow(10, exp)).toNumber();
  return `${mantissa.toFixed(digits)}e${exp}`;
}

export function formatRate(d: Decimal): string {
  return `${formatNumber(d, { digits: 2, allowFraction: true })}/s`;
}

/** Like formatRate but without the "/s" suffix — for inline math breakdowns. */
export function formatSupply(d: Decimal): string {
  return formatNumber(d, { digits: 2, allowFraction: true });
}
