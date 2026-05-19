import { ChainId, ProducerDef } from "./types";

// All four chains, GDD Appendix B (v0.1 alpha numbers, expect re-tuning).
// Output is each tier's contribution to its CHAIN'S supply (not directly to Tokens).
// Tokens come out of the Liebig pipeline in math.ts: min(gpu,data,energy) * sqrt(eng).

export const ENGINEERS: ProducerDef[] = [
  { id: "intern",            chain: "engineers", name: "Intern",             tierIdx: 0, baseCostCapital:           15, costMult: 1.07, baseOutputPerSec:     0.10 },
  { id: "new_grad",          chain: "engineers", name: "New Grad",           tierIdx: 1, baseCostCapital:          100, costMult: 1.07, baseOutputPerSec:     1.00 },
  { id: "mid_eng",           chain: "engineers", name: "Mid Engineer",       tierIdx: 2, baseCostCapital:        1_100, costMult: 1.08, baseOutputPerSec:     8.00 },
  { id: "senior_eng",        chain: "engineers", name: "Senior Engineer",    tierIdx: 3, baseCostCapital:       12_000, costMult: 1.08, baseOutputPerSec:    47.00 },
  { id: "staff_eng",         chain: "engineers", name: "Staff Engineer",     tierIdx: 4, baseCostCapital:      130_000, costMult: 1.09, baseOutputPerSec:   260.00 },
  { id: "principal_eng",     chain: "engineers", name: "Principal Engineer", tierIdx: 5, baseCostCapital:    1_400_000, costMult: 1.10, baseOutputPerSec: 1_400.00 },
  { id: "distinguished_eng", chain: "engineers", name: "Distinguished Eng.", tierIdx: 6, baseCostCapital:   20_000_000, costMult: 1.11, baseOutputPerSec: 7_800.00 },
  { id: "fellow",            chain: "engineers", name: "Fellow",             tierIdx: 7, baseCostCapital:  330_000_000, costMult: 1.12, baseOutputPerSec: 44_000.00 },
];

export const GPU: ProducerDef[] = [
  { id: "single_h100",       chain: "gpu", name: "Single H100",       tierIdx: 0, baseCostCapital:          50, costMult: 1.07, baseOutputPerSec:     0.30 },
  { id: "dgx_box",           chain: "gpu", name: "DGX Box",           tierIdx: 1, baseCostCapital:         550, costMult: 1.08, baseOutputPerSec:     2.60 },
  { id: "server_rack",       chain: "gpu", name: "Server Rack",       tierIdx: 2, baseCostCapital:       6_600, costMult: 1.09, baseOutputPerSec:    20.00 },
  { id: "cluster",           chain: "gpu", name: "Cluster",           tierIdx: 3, baseCostCapital:      79_000, costMult: 1.10, baseOutputPerSec:   145.00 },
  { id: "datacenter_pod",    chain: "gpu", name: "Datacenter Pod",    tierIdx: 4, baseCostCapital:     950_000, costMult: 1.11, baseOutputPerSec:   950.00 },
  { id: "hyperscale_region", chain: "gpu", name: "Hyperscale Region", tierIdx: 5, baseCostCapital:  11_500_000, costMult: 1.12, baseOutputPerSec: 5_800.00 },
  { id: "continent_scale",   chain: "gpu", name: "Continent-Scale",   tierIdx: 6, baseCostCapital: 140_000_000, costMult: 1.13, baseOutputPerSec: 33_000.00 },
];

export const DATA: ProducerDef[] = [
  { id: "common_crawl",      chain: "data", name: "Common Crawl Dump",    tierIdx: 0, baseCostCapital:          30, costMult: 1.07, baseOutputPerSec:     0.20 },
  { id: "scraped_forums",    chain: "data", name: "Scraped Forums",       tierIdx: 1, baseCostCapital:         330, costMult: 1.08, baseOutputPerSec:     1.70 },
  { id: "licensed_books",    chain: "data", name: "Licensed Books",       tierIdx: 2, baseCostCapital:       3_900, costMult: 1.09, baseOutputPerSec:    13.00 },
  { id: "news_archive",      chain: "data", name: "News Archive Deal",    tierIdx: 3, baseCostCapital:      46_000, costMult: 1.10, baseOutputPerSec:    90.00 },
  { id: "synthetic_pipe",    chain: "data", name: "Synthetic Pipeline",   tierIdx: 4, baseCostCapital:     550_000, costMult: 1.11, baseOutputPerSec:   590.00 },
  { id: "proprietary_rlhf",  chain: "data", name: "Proprietary RLHF",     tierIdx: 5, baseCostCapital:   6_600_000, costMult: 1.12, baseOutputPerSec: 3_700.00 },
  { id: "mass_surveillance", chain: "data", name: "Mass Surveillance Tap",tierIdx: 6, baseCostCapital:  79_000_000, costMult: 1.14, baseOutputPerSec: 21_000.00 },
];

export const ENERGY: ProducerDef[] = [
  { id: "office_grid",       chain: "energy", name: "Office Grid",         tierIdx: 0, baseCostCapital:          20, costMult: 1.07, baseOutputPerSec:     0.15 },
  { id: "industrial_pwr",    chain: "energy", name: "Industrial Contract", tierIdx: 1, baseCostCapital:         220, costMult: 1.08, baseOutputPerSec:     1.30 },
  { id: "solar_farm",        chain: "energy", name: "Solar Farm",          tierIdx: 2, baseCostCapital:       2_600, costMult: 1.09, baseOutputPerSec:    10.00 },
  { id: "hydro_lease",       chain: "energy", name: "Hydro Lease",         tierIdx: 3, baseCostCapital:      31_000, costMult: 1.10, baseOutputPerSec:    70.00 },
  { id: "nuclear_ppa",       chain: "energy", name: "Nuclear PPA",         tierIdx: 4, baseCostCapital:     380_000, costMult: 1.11, baseOutputPerSec:   460.00 },
  { id: "geothermal_plant",  chain: "energy", name: "Geothermal Plant",    tierIdx: 5, baseCostCapital:   4_600_000, costMult: 1.12, baseOutputPerSec: 2_900.00 },
  { id: "fusion_pilot",      chain: "energy", name: "Fusion Pilot",        tierIdx: 6, baseCostCapital:  55_000_000, costMult: 1.13, baseOutputPerSec: 17_000.00 },
];

export const CHAINS: ReadonlyArray<{ id: ChainId; name: string; producers: ProducerDef[] }> = [
  { id: "engineers", name: "Engineers", producers: ENGINEERS },
  { id: "gpu",       name: "GPU",       producers: GPU },
  { id: "data",      name: "Data",      producers: DATA },
  { id: "energy",    name: "Energy",    producers: ENERGY },
];

export const ALL_PRODUCERS: ProducerDef[] = CHAINS.flatMap((c) => c.producers);

export const PRODUCER_BY_ID: Record<string, ProducerDef> = Object.fromEntries(
  ALL_PRODUCERS.map((p) => [p.id, p])
);

export function producersForChain(chain: ChainId): ProducerDef[] {
  return CHAINS.find((c) => c.id === chain)?.producers ?? [];
}
