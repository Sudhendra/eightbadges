/** The exact decomp commit all game data comes from. Change it deliberately, then rebuild and review the diff. */
export const DECOMP_COMMIT = "731ad5bfd6e6f265508d0efcca0ba42f9dcf5881";

export const DECOMP_DIR = ".cache/pokeemerald";
export const OUTPUT_DIR = "data/emerald";

/**
 * Gzipped size ceilings, in bytes, enforced by tests. Pages load only the files they use,
 * so every file gets a budget. Raising one should be a conscious decision.
 */
export const GZIP_BUDGETS: Record<string, number> = {
  "world.json": 11_000,
  "places.json": 10_000,
  "species.json": 20_000,
  "moves.json": 9_500,
  "abilities.json": 1_300,
  "items.json": 8_500,
  "learnsets.json": 28_000,
  "trainers.json": 35_000,
  "encounters.json": 6_500,
};
