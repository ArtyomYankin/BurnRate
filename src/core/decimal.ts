import Decimal, { DecimalSource } from "break_eternity.js";

export { Decimal };
export type { DecimalSource };

export const D = (x: DecimalSource): Decimal => new Decimal(x);

export const ZERO = D(0);
export const ONE = D(1);
