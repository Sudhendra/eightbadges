# Eight Badges

The best route through Pokémon Emerald, for every starter. What to catch, who gets which TM, where to find it, and how to beat what's next.

A non-commercial fan project. Not affiliated with Nintendo, Creatures, Game Freak or The Pokémon Company.

## Status

The game data pipeline is built. The site comes next.

## Game data

`data/emerald/` holds structured facts extracted from the [pret/pokeemerald](https://github.com/pret/pokeemerald) decompilation, pinned to one commit. Each file is loaded on its own, so a page fetches only what it uses.

| File | Contents |
|---|---|
| `world.json` | Maps, region map sections, and how maps connect |
| `places.json` | Each map's trainers, items, shops and Pokémon gifts |
| `species.json` | All 386 species: stats, types, abilities, evolutions |
| `learnsets.json` | Level-up, TM/HM, tutor and egg moves |
| `moves.json` | All 354 moves, with their Gen 3 physical or special split |
| `items.json` | Items, including where to find each one |
| `trainers.json` | Every trainer's team, items and AI flags |
| `encounters.json` | Wild Pokémon per map and method, with chances |
| `abilities.json` | Ability names |
| `manifest.json` | Source commit, counts, sizes and hashes |

The output contains no sprites, dialogue, descriptions or other game text beyond names.

## Commands

Requires Node 22.18 or newer and pnpm.

```bash
pnpm install
```

```bash
pnpm data
```

```bash
pnpm test
```

```bash
pnpm typecheck
```

`pnpm data` fetches the decomp's text files into `.cache/` and rebuilds `data/emerald/`. Nothing from the decomp is executed.

Tests check the output against known game facts and Pokémon Showdown's Gen 3 data, enforce a gzip budget per file, and confirm the committed data matches a fresh build.

## Docs

- [Project decisions](docs/decisions.md)
- [Emerald foundation research](docs/emerald-foundation-research.md)
