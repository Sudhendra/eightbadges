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

## Foresight

- **Picks are explainable, not magic.** Each pick scores for its type matchup in the next fight, how much it covers the coming fights where your starter struggles, and raw strength. Abilities that cripple a Pokémon, like Truant, count against it.
- **Assumptions are stated on the page:** a pick is raised to each fight's level, with level-up moves and level-up evolutions only.
- **Story progress is hand-written and conservative.** Each stop lists what it opens. When unsure, an area opens later, so Foresight never suggests something you can't reach.
- **One-time choices are weighed against every fight left** for your starter.

## Team planner

- **One engine everywhere.** `shared/engine.ts` has no imports. The build strips its types for the browser, and a test checks the browser copy gives identical answers.
- **Teams are rated on their weakest link.** EASY means every opponent has a clear answer on your team, TOUGH means one has none. Averages hid the gaps that matter.
- **Members join when you can first catch them, and TMs count once you can get them.** TM moves take priority over level-up moves, four moves at most.
- **The team lives in the URL hash**, like `#mudkip+tm_ice_beam,lotad,sableye`. That makes every team a shareable link, and it's the starting point for route sharing.
- **Only the planner page loads JavaScript and data.** About 6 KB of code and 43 KB of data, gzipped.

## Known data gaps

- **Move behavior:** stored accuracy, priority or power values differ from Showdown for 32 moves. The simulator must confirm how each behaves in battle.
- **Story gates:** what each stop opens is tracked by region map section, not by individual map, so a few areas are marked open later than the game allows. "How do I get out of here?" pathfinding still needs gates on individual connections.
- **Foresight's limits:** picks don't consider TMs, stone evolutions, held items or team synergy yet.
- **Trainer details:** natures and money rewards aren't extracted yet, and AI flags aren't connected to any behavior yet.
- **Item sources:** based on what scripts reference. They don't yet say when an item becomes available, or its cost in coins or points.
- **Reachability:** 47 maps entered through game systems, such as secret bases and Pyramid floors, don't connect in the graph. A test lists which ones are expected.
