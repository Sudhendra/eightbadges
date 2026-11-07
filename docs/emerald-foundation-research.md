# Emerald foundation research

Researched 2026-11-07. Decomp numbers come from `pret/pokeemerald` at commit `731ad5b`, measured directly rather than quoted from a wiki. This is research, not legal advice.

## The main findings

1. **Almost everything you need exists as structured text.** The Emerald decomp has maps, event scripts, flags, trainer teams, wild encounters and TM compatibility in parseable files.
2. **Emerald is not a branching story, so the product shouldn't be a story tree.** Starter choice changes rival teams, one NPC line and a doll. The real decisions are team-building ones: who to catch, who gets which single-use TM, and what to do before each fight. The site should be a linear story spine with a planner attached.
3. **Nothing visual is free to use.** Every sprite and tileset source is Nintendo, Creatures or Game Freak art, whatever license the repo that hosts it carries.
4. **The "complete game sim on the website" has to change shape.** See [Bot competition](#bot-competition).
5. **`fortheloveofpokemon.com` is already registered**, and "Pokémon" in a domain is a known trademark risk anyway.
6. **This space isn't empty.** PokeTools covers the guide and planner basics, and PokéAgent already runs an Emerald bot benchmark. Your opening is described in [Existing competition](#existing-competition).

## What the game data says

| Measure | Count |
|---|---|
| Maps (`map.json`) | 518 |
| Map connections / warp events | 148 / 1,313 |
| Hidden items | 112 |
| Trainers defined / double battles | 855 / 77 |
| Trainer objects placed on maps | 552 |
| Wild encounter tables / unique species | 135 / 143 |
| Non-unused flags / vars | 1,154 / 255 |
| Event script lines (525 files) | about 94,000 |
| Player prompts (yes/no + multichoice) | 512 |

Most of the 512 prompts are not story decisions. The busiest files are Battle Frontier, cable club, secret bases, contests and similar side systems.

### What starter choice actually changes

`VAR_STARTER_MON` appears only 16 times, in 8 script files:

- **Rival battles:** the rival's team at Route 103, Rustboro (scripted in two files), Route 110, Route 119 and Lilycove. That's 5 fights × 3 starters × 2 rival genders = the 30 starter-specific trainer entries.
- **Petalburg Pokémon Center:** one line of NPC dialogue.
- **Mauville Game Corner:** which starter doll you can get.

So "repercussions per starter" are almost entirely battle matchups, not plot.

### True either/or choices found so far

| Choice | Options | Evidence |
|---|---|---|
| Starter | Treecko / Torchic / Mudkip | `VAR_STARTER_MON` |
| Fossil | Root / Claw (the other disappears) | `FLAG_CHOSE_ROOT_FOSSIL`, `FLAG_CHOSE_CLAW_FOSSIL` |
| TV question | Latias / Latios roamer | `MULTI_TV_LATI`, `VAR_ROAMER_POKEMON` |
| Johto starter (post-game) | Chikorita / Cyndaquil / Totodile | `VAR_DEX_UPGRADE_JOHTO_STARTER_STATE` |

This list comes from targeted searches, so it isn't exhaustive. An audit should come before we publish "every decision".

The irreversible resource decisions matter more than these: Gen 3 TMs are single-use, and catch, evolution, HM-slot and Master Ball choices all compete with each other.

### Proposed model: three layers

| Layer | What it holds | How it gets built |
|---|---|---|
| **Story spine** | Gated, ordered progress: badges, HMs, villain events | Hand-authored, checked against `VAR_*_STATE` and flags. My rough estimate is 60–100 nodes |
| **Exclusive forks** | The table above | Hand-authored from the scripts |
| **Team planner** | Catches, TMs, evolutions, per-fight results against real trainer teams | Generated from data and simulated |

### World map graph test

I built a graph from `map.json` with no art at all:

- **Connections and warps only:** 319 of 518 maps reachable from Littleroot.
- **With scripted warps added:** 409 of 518.
- **Still missing:** Sootopolis, Seafloor Cavern and other dive-entered areas (these need hand-added links), plus secret bases, contest rooms and unused maps, which mostly don't matter.

The graph ignores story and HM gates. Its Littleroot → Ever Grande path crosses water you can't cross early on, so gates must be a separate overlay. That overlay is what would power "I'm lost, how do I get out?".

It also suggests a strong visual idea: **draw Hoenn as a transit map in original SVG.** It would look clean and distinctive, and wouldn't use any Nintendo tiles.

## Asset inventory

### Game data

| Need | Source | Rights as stated | How to use it |
|---|---|---|---|
| Maps, warps, events, flags, scripts, trainers, encounters, learnsets | [pret/pokeemerald](https://github.com/pret/pokeemerald) | No license declared; underlying game is Nintendo's | Primary source. Extract facts, pin the commit |
| Cross-checks on species, moves, items | [PokeAPI/api-data](https://github.com/PokeAPI/api-data) (static JSON) | BSD-3 for the project | Secondary source, no API dependency |
| Battle mechanics and data | [smogon/pokemon-showdown](https://github.com/smogon/pokemon-showdown), [pkmn/ps](https://github.com/pkmn/ps) | MIT | Simulation engine |
| Instant damage numbers | [smogon/damage-calc](https://github.com/smogon/damage-calc) | MIT | Planner UI |
| Map and script tooling | [Porymap](https://github.com/huderlem/porymap) (LGPL-3.0), [Poryscript](https://github.com/huderlem/poryscript) (MIT) | As listed | Reference for parsing formats |

Exact files in the decomp:

- `data/maps/*/map.json` and `data/maps/*/scripts.inc`
- `data/scripts/*.inc`
- `src/data/trainers.h` and `src/data/trainer_parties.h`
- `src/data/wild_encounters.json`
- `src/data/pokemon/tmhm_learnsets.h` and `src/data/pokemon/evolution.h`
- `include/constants/flags.h` and `include/constants/vars.h`

### Story and guide text

| Source | Status | How to use it |
|---|---|---|
| Dialogue in decomp scripts | Nintendo's text | Don't republish. Write original summaries |
| [Bulbapedia walkthrough](https://bulbapedia.bulbagarden.net/wiki/Appendix%3AEmerald_walkthrough) | [Text is CC BY-NC-SA](https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:Copyrights); images are claimed as fair use | Check facts and link. Copying forces non-commercial and share-alike terms on us |
| [speedrun.com Emerald guides](https://www.speedrun.com/pkmnemerald/guide/uvcb6) | Community-written, terms not reviewed | Link and credit, ask authors before reusing |

Route data is thin. I found a 2017 Mudkip glitchless route and an old Torchic recommendation on [Smogon](https://smogon.com/forums/threads/speedrunning-guide-emerald.61700/page-2), but no current Treecko route. A rigorous three-starter comparison would be new, though I only ran one search on this.

### Visuals

| Source | Status | Recommendation |
|---|---|---|
| [PokeAPI/sprites](https://github.com/PokeAPI/sprites) | Repo says CC0, but also "All image contents within are Copyright The Pokémon Company" | CC0 does not clear the art |
| [PokéSprite](https://github.com/msikma/pokesprite) | Code is MIT, sprites © Nintendo/Creatures/Game Freak | Same |
| [smogon/sprites](https://github.com/smogon/sprites) | No license declared | Same |
| Decomp graphics (838 front sprites, 226 tileset PNGs, 473 item files) | Nintendo art | Don't ship |
| Map rips such as VGMaps | Not checked; these are game graphics | Avoid; use the transit map instead |
| Icons, UI, logo | Commission or draw originals | Retro feel, zero borrowed art |

Fonts, all reported as Open Font License. Confirm on each [Google Fonts](https://fonts.google.com) page before shipping. Avoid fan rips of the in-game fonts.

- [Pixelify Sans](https://fontsource.org/fonts/pixelify-sans/about): four weights, probably the best heading choice
- [Press Start 2P](https://fontsource.org/fonts/press-start-2p/about): the most arcade-looking, but tiring at length
- VT323: terminal look, the most readable at length
- Silkscreen: good for tiny labels

A starting pair to react to: Pixelify Sans for headings, with a plain sans-serif for body text so long guides stay readable.

## Legal risk

| Precedent | Takeaway |
|---|---|
| [Pokémon Essentials, 2018](https://www.engadget.com/2018-08-29-pokemon-essentials-nintendo-takedown.html) | Bundling real sprites, music and tilesets drew a claim |
| [Relic Castle, 2024](https://www.gamesradar.com/after-almost-10-years-unofficial-pokemon-website-known-for-sharing-fan-made-games-shuts-down-after-reportedly-receiving-a-dmca-takedown-notice) | Long-running fan sites aren't immune |
| [Former Pokémon lawyer](https://www.levelup.com/en/news/lawyer-reveals-how-the-pokemon-company-discovers-and-cancels-fan-projects/) | They monitor big projects and don't always act at once; monetizing raises the risk |
| [PokéRogue](https://github.com/pagefaultgames/pokerogue), [PokeTools](https://www.poketools.com/emerald) | Both active today, so enforcement is uneven. That isn't a safe harbor |
| [Pokémon domains](https://www.circleid.com/posts/20160721_pokemon_domain_names_are_a_no_go) | Reported UDRP disputes have tended to end in transfer. I found no decision about a non-commercial fan site |
| [Nintendo tournament guidelines](https://nintendo.com/au/legal/community-tournament-guidelines) | Show Nintendo's line: small, non-commercial, 300 online participants, roughly $5,000 in prizes. Written for tournaments, so fit to a bot league is unclear |

Rules I'd adopt:

- Host no ROMs and no save states.
- Don't ship game text, music or tilesets.
- Keep the Pokémon name out of the domain and logo.
- Put a clear "fan project, not affiliated" notice on every page.
- No ads, paid tiers or entry fees at launch.
- Load every Pokémon sprite through one swappable function, so they can all be replaced in one commit if a notice arrives.

Talk to an IP lawyer before offering prizes or adding revenue.

## Existing competition

| Project | Has | Doesn't appear to have |
|---|---|---|
| [PokeTools Emerald](https://www.poketools.com/emerald) | Ordered route guide, story-gate help, TM planner with conflict flags, Hoenn map, Nuzlocke tracker | Decision graphs, user-submitted routes, ratings, bots |
| [PokeTools Playthrough Planner](https://www.poketools.com/playthrough-planner) | Team score per gym | Real matchups: it says scoring uses "gym specialty types only" |
| [PokéAgent Challenge](https://pokeagentchallenge.com) | Emerald speedrun benchmark for AI, ranked on actions and time | Consumer guide, human routes |

**The opening:** a visual decision map, plans simulated against real trainer teams, community routes ranked by evidence as well as votes, and one route format shared by humans and bots.

## Bot competition

### What I won't build

I won't build a playable recreation of Emerald on the site, with its maps, characters, art or music, even renamed. It's also the exact category that gets taken down. The two options below still give you real competition.

### Track A: Route Solver (hostable, build first)

- Bots submit a **plan**: catches, TMs, evolutions, levels, team per fight.
- The server simulates it against real trainer teams using `@pkmn/sim`, and scores win rate, risk and estimated time.
- There's no overworld, art or ROM, so it runs entirely on Cloudflare.
- **Known gap:** Showdown-style simulation does not include cartridge trainer AI. That has to be ported from the decomp's logic or scores won't match real play.
- [`pkmn/engine`](https://github.com/pkmn/engine) would be much faster, but its README lists ADV (Gen 3) as a future milestone, so it's a later upgrade.

### Track B: True Speedrun (bring your own ROM)

- [`@thenick775/mgba-wasm`](https://www.npmjs.com/package/@thenick775/mgba-wasm) (MPL-2.0, v2.6.0) runs mGBA in the browser.
- Users load their own legally dumped ROM. It stays in their browser and is checked against the known hash, `f3ae088181bf583e55daf962a92bb46f4f1d07b7`.
- Bots submit **input logs** instead of videos.
- **Replay looks feasible.** Vanilla Emerald compiles out RTC seeding of its RNG (`SeedRngWithRtc` sits behind `#ifdef BUGFIX`), so identical inputs on a pinned emulator build should replay identically. I haven't tested this yet, and it's the first spike to run.
- **The catch:** the server can't verify runs without holding a ROM, and it shouldn't hold one. Verification happens in other users' browsers with their own ROMs, plus a local check by you for any prize-eligible run.
- Determinism also means bots can exploit exact frame timing. The 2017 route already relies on a specific frame-picked Mudkip. That needs a rule or a separate category.
- **Reuse:** [`continual-harness`](https://github.com/sethkarten/continual-harness) (MIT) is a PokéAgent reference harness built on mGBA with a user-supplied ROM. Matching its interface makes existing bots easy to bring over.

### Prize ideas

PokéAgent's [2025 prizes](https://pokeagent.github.io/track2.html) were cash plus cloud credits, backed by sponsors. I'd avoid cash at first.

1. **Become the boss (my favorite).** Season winners' bots become the league's Elite Four, and everyone next season has to beat them. It costs almost nothing and gives people a reason to come back.
2. **Pixel trophy:** a physical trophy with the bot's name, using original art.
3. **Engraved handheld:** a Miyoo Mini Plus with the winner's name, shipped empty with no ROMs. It's a nice nod to why this project exists.
4. **AI lab credits:** the most useful prize for bot builders, if you can land a sponsor.
5. **Commissioned pixel art** of the winning bot's mascot.

Season 1 suggestion: Elite Four seat, trophy, and credits if a sponsor appears. No entry fees.

## Cloudflare architecture

```
Static site (Workers Static Assets)
  Astro pages + React islands, React Flow for the decision map

API (Workers + Hono)
  D1:              users, routes, votes, leaderboards
  R2:              input logs, replays, generated JSON
  Durable Objects: live leaderboards, rate limiting
  Queues → Workers or Containers: route simulation jobs
  Turnstile + GitHub/Discord OAuth: abuse control

Build-time pipeline (runs in CI, not at request time)
  pinned decomp + PokeAPI → normalized emerald.json → hand-authored overlays
```

| Service | Published limit or price |
|---|---|
| [Workers](https://developers.cloudflare.com/workers/platform/limits/) | $5/month paid plan; 128 MB memory; up to 5 min CPU per request |
| [D1](https://developers.cloudflare.com/d1/platform/pricing/) | 10 GB per database; 25B reads and 50M writes per month included, 5 GB storage included |
| [R2](https://developers.cloudflare.com/r2/pricing/) | $0.015/GB-month, no egress fees |
| [Containers](https://developers.cloudflare.com/containers/pricing/) | 375 vCPU-minutes, 25 GiB-hours memory and 200 GB-hours disk included; $0.000020 per extra vCPU-second |

The graph UI has a clear pick: [React Flow](https://github.com/xyflow/xyflow) (MIT). Fallback for very large graphs: [Cytoscape.js](https://github.com/cytoscape/cytoscape.js) (MIT).

### Route format (sketch)

Humans and bots both submit this, which is what makes rankings comparable:

```json
{
  "game": "emerald-us-1.0",
  "starter": "mudkip",
  "objective": "fastest-safe-clear",
  "steps": [
    { "at": "route-102", "do": "catch", "species": "RALTS" },
    { "at": "before-roxanne", "do": "party", "members": ["MARSHTOMP", "RALTS"] },
    { "at": "dewford-gym", "do": "tm", "item": "TM08", "target": "MARSHTOMP" }
  ]
}
```

"Optimal" has no single meaning, so each leaderboard needs its own stated objective, such as fastest, safest, or no legendaries.

Ranking should separate two signals: a **simulated score**, and **community rating** from a Wilson or Bayesian score rather than raw averages. A "replayed by N people" badge would add evidence on top.

## Name options

Domain status is from RDAP and WHOIS on 2026-11-07. "Open" means no registry record, not a guaranteed purchase: some may be premium-priced or reserved. Names are not trademark-cleared, and several use in-game terms.

| Name | Domains | Why it works |
|---|---|---|
| **Escape Rope** (top pick) | `.gg` `.dev` `.app` `.run` open; `.com` taken | It's your exact problem: "I'm lost, get me out." Works for every game, has an obvious pixel icon, and it's an everyday noun |
| **Eight Badges** | `.com` `.gg` `.run` open | The clearest quest statement, sounds like a league, and has the only clean `.com` of the strong options |
| **Happy Path** | `.gg` open; `.run` taken | Your own phrase, and a dev joke. It suits the bot crowd but is less obvious to general fans |
| **Party of Six** | `.gg` `.dev` `.app` open; `.com` taken | Warm and about team-building, but undersells maps and bots |
| **Ledgehop** | `.com` `.gg` open | One-way ledges as a metaphor for irreversible choices. Clever, but needs explaining |
| **Whited Out** | `.com` open | Funny, but it's named after losing |
| **For the Love of Pokémon** | `.com` taken; `.gg` open | Heartfelt, but carries the trademark risk. Better as a tagline, or an about-page line |

No search result showed an existing Pokémon site named Escape Rope, but that was one shallow search. Do a proper trademark search before buying. I also couldn't confirm that Cloudflare Registrar sells `.gg`; check its [TLD list](https://www.cloudflare.com/tld-policies/). A domain from another registrar can still use Cloudflare DNS.

## Suggested build order

1. **Data pipeline:** decomp + PokeAPI → `emerald.json`, with validation tests.
2. **Story spine + transit map:** the first thing that looks unlike anything else out there.
3. **Three starter routes, one per starter, simulated against every gym and the Elite Four.** This is the differentiator over type-only scoring.
4. **Route submission and rating.**
5. **Solver leaderboard (Track A).**
6. **Determinism spike, then BYO-ROM speedruns (Track B).**
