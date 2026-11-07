# Project decisions

## Product

- **Name:** Eight Badges.
- **Scope:** Emerald only for now. Bots, prizes and other games come later.
- **Shape:** a linear story path, the few true either/or choices, and a team planner tested against real trainer teams.
- **Non-commercial at launch:** no ads, paid tiers or entry fees.
- **Sprites:** real Pokémon sprites, all loaded through one function so they can be swapped in a single commit.
- **No playable recreation of Emerald.** Bots compete through a route solver, and later through speedruns on the user's own ROM.

## Feel and speed

Feel and speed outrank features. The site should be very lean, load extremely fast, and feel retro, minimal and super fun.

- Pages load only the data they use.
- Every data file has a gzip budget, enforced by tests in `pipeline/config.ts`.
- Pipeline code has no runtime dependencies.
- Fonts get decided iteratively, by trying them on the real site.

## Data

- **The decomp is the source of truth.** Where it disagrees with Showdown, we keep the cartridge's value and list the difference in `pipeline/test/crosscheck.test.ts`.
- **Showdown replaces PokeAPI as the cross-check.** Its data is specific to Gen 3, so it's the stronger test.
- **Facts only.** No dialogue or item, move or ability descriptions. Guide text gets written from scratch.

## Known data gaps

- **Move behavior:** stored accuracy, priority or power values differ from Showdown for 32 moves. The simulator must confirm how each behaves in battle.
- **Story gates:** map connections ignore HMs, badges and story events. Those need a hand-built layer, which also powers "how do I get out of here?".
- **Trainer details:** natures and money rewards aren't extracted yet, and AI flags aren't connected to any behavior yet.
- **Item sources:** based on what scripts reference. They don't yet say when an item becomes available, or its cost in coins or points.
- **Reachability:** 47 maps entered through game systems, such as secret bases and Pyramid floors, don't connect in the graph. A test lists which ones are expected.
