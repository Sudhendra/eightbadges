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
- No framework. Pages are static HTML from a small build script, with CSS and JS inlined so the first screen arrives in one round trip.
- Pipeline and site code have no runtime dependencies.
- Fonts: Silkscreen for headings and VT323 for body, self-hosted. Pixelify Sans was dropped because its "C" reads as "O" at small sizes. Still open to change: press F on the dev site to compare.

## Open source

- Code is MIT licensed. Pokémon's names, characters and sprites stay with their owners.
- Sprites are never committed to git. The build fetches them from a pinned PokeAPI/sprites commit, and only those in use.
- Story content lives in one plain JSON file, so fans can fix it without touching code.

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
