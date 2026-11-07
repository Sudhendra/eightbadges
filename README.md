# Eight Badges

Pick your starter and see your whole road to Champion in Pokémon Emerald: every gym, rival and boss, with real teams and how you match up.

**[eightbadges.com](https://eightbadges.com)**

A non-commercial fan project. Not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company.

## Why it's different

- **Built from the game itself.** Teams, moves and matchups come from the [Emerald decompilation](https://github.com/pret/pokeemerald), and tests cross-check them against Pokémon Showdown's Gen 3 data.
- **Fast and small.** The home page is about 6 KB gzipped, with all its CSS and JS included. Tests enforce size budgets.
- **Plays like a game.** Arrow keys and Enter move you around, and sound is one toggle away.

## Run it

Requires Node 22.18 or newer and pnpm.

```bash
pnpm install
```

```bash
pnpm dev
```

Then open <http://localhost:4321>.

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the site locally |
| `pnpm build` | Builds the site into `dist/` |
| `pnpm test` | Runs all tests |
| `pnpm typecheck` | Checks types |
| `pnpm data` | Fetches the decomp and regenerates `data/emerald/` |
| `pnpm run deploy` | Builds and publishes to Cloudflare (maintainers) |

## Game data

`data/emerald/` holds facts extracted from the decomp, pinned to one commit. Each file loads on its own, so a page fetches only what it uses.

| File | Contents |
|---|---|
| `world.json` | Maps, region map sections, and how maps connect |
| `places.json` | Each map's trainers, items, shops and Pokémon gifts |
| `species.json` | All 386 species: stats, types, abilities, evolutions |
| `learnsets.json` | Level-up, TM/HM, tutor and egg moves |
| `moves.json` | All 354 moves, with their Gen 3 physical or special split |
| `types.json` | The Gen 3 type chart |
| `items.json` | Items, including where to find each one |
| `trainers.json` | Every trainer's team, items and AI flags |
| `encounters.json` | Wild Pokémon per map and method, with chances |
| `abilities.json` | Ability names |
| `manifest.json` | Source commit, counts, sizes and hashes |

The story path in `content/emerald/journey.json` is written by hand.

## Contributing

Fixes and ideas are very welcome, and you don't need to write code to help. See [CONTRIBUTING.md](CONTRIBUTING.md).

## More

- [Project decisions](docs/decisions.md)
- [Emerald foundation research](docs/emerald-foundation-research.md)

## License

The code is [MIT licensed](LICENSE). Pokémon itself belongs to its owners, and sprites are never stored in this repo.
