#!/usr/bin/env bash
# Fetches only the text data the pipeline reads from the Emerald decomp, at a pinned commit.
# Graphics, audio and code are deliberately left out. Nothing in the checkout is ever executed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMMIT="$(sed -n "s/.*DECOMP_COMMIT = \"\([0-9a-f]*\)\".*/\1/p" "$ROOT/pipeline/config.ts")"
DEST="$ROOT/.cache/pokeemerald"

if [ -z "$COMMIT" ]; then
  echo "Could not read DECOMP_COMMIT from pipeline/config.ts" >&2
  exit 1
fi

if [ "$(git -C "$DEST" rev-parse HEAD 2>/dev/null || true)" = "$COMMIT" ]; then
  echo "Decomp already at $COMMIT"
  exit 0
fi

rm -rf "$DEST"
mkdir -p "$DEST"
git -C "$DEST" init --quiet
git -C "$DEST" remote add origin https://github.com/pret/pokeemerald.git
git -C "$DEST" sparse-checkout set --no-cone \
  '/data/maps/**/map.json' \
  '/data/maps/**/scripts.inc' \
  '/data/scripts/*.inc' \
  '/include/constants/pokedex.h' \
  '/src/data/battle_moves.h' \
  '/src/data/items.h' \
  '/src/data/trainers.h' \
  '/src/data/trainer_parties.h' \
  '/src/data/wild_encounters.json' \
  '/src/data/pokemon/species_info.h' \
  '/src/data/pokemon/evolution.h' \
  '/src/data/pokemon/level_up_learnsets.h' \
  '/src/data/pokemon/level_up_learnset_pointers.h' \
  '/src/data/pokemon/tmhm_learnsets.h' \
  '/src/data/pokemon/tutor_learnsets.h' \
  '/src/data/pokemon/egg_moves.h' \
  '/src/data/region_map/region_map_sections.json' \
  '/src/data/text/species_names.h' \
  '/src/data/text/move_names.h' \
  '/src/data/text/abilities.h'
git -C "$DEST" fetch --quiet --depth 1 --filter=blob:none origin "$COMMIT"
git -C "$DEST" checkout --quiet FETCH_HEAD
echo "Decomp ready at $(git -C "$DEST" rev-parse HEAD)"
