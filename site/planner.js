// Team planner. Loads only on /planner/. Uses the same matchup engine as the rest of the site.
import { teamMatchup, stageAtLevel } from "./engine.js";

const STARTERS = ["treecko", "torchic", "mudkip"];
const VERDICT = { easy: "EASY", fair: "FAIR", tough: "TOUGH" };
const root = document.getElementById("planner");
const data = await (await fetch(root.dataset.src)).json();

for (const [id, mon] of Object.entries(data.species)) mon.id = id;
const lookup = {
  species: (id) => data.species[id],
  move: (id) => data.moves[id],
  levelMoves: (id) => data.species[id].level,
  chart: data.chart,
};
const spriteBase = data.spriteExample.replace(/1\.png$/, "");
const machineById = Object.fromEntries(data.machines.map((machine) => [machine.id, machine]));

const esc = (text) => String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
const name = (species) => data.species[species].name;
const sprite = (species, size = 64) =>
  `<img class="sprite" src="${spriteBase}${data.species[species].dex}.png" alt="${esc(name(species))}" width="${size}" height="${size}" loading="lazy">`;
const stopLabel = (index) => {
  const stop = data.stops[index];
  if (!stop) return "after the Champion";
  return stop.kind === "rival" || stop.kind === "villain" ? `before ${stop.title}, ${stop.place}` : `before ${stop.title}`;
};
const multiplier = (value) => (value === 0.25 ? "×¼" : value === 0.5 ? "×½" : `×${value}`);

/** Every form a species reaches by levelling, so TMs can be offered for any of them. */
const lineOf = (species) => {
  const forms = [species];
  for (let current = data.species[species]; ; ) {
    const next = current.evolutions.find((evo) => evo.method === "level");
    if (!next) return forms;
    forms.push(next.to);
    current = data.species[next.to];
  }
};

// State lives in the address, so a team is a link you can share: #mudkip,lotad+tm_bullet_seed,sableye
let state = { starter: "treecko", members: [{ species: "treecko", tms: [] }] };

function readHash() {
  const parts = decodeURIComponent(location.hash.slice(1)).split(",").filter(Boolean);
  const members = parts.map((part) => {
    const [species, ...tms] = part.split("+");
    return { species, tms: tms.filter((tm) => machineById[tm]) };
  }).filter((member) => data.species[member.species]);
  if (members[0] && STARTERS.includes(members[0].species)) {
    state = { starter: members[0].species, members: members.slice(0, 6) };
  }
}

function writeHash() {
  const text = state.members.map((member) => [member.species, ...member.tms].join("+")).join(",");
  history.replaceState(null, "", `#${text}`);
  try { localStorage.setItem("planner", text); } catch { /* Private mode is fine. */ }
}

const joinsAt = (member, index) => (index === 0 ? 0 : data.catchable[member.species] ?? data.stops.length);

function partyFor(stop) {
  return Array.isArray(stop.party) ? stop.party : stop.party[state.starter];
}

/** The team as it stands at a fight: who's caught by then, and which TM moves they can use. */
function teamAt(stopIndex, level) {
  const present = [];
  state.members.forEach((member, i) => {
    if (joinsAt(member, i) > stopIndex) return;
    const stage = stageAtLevel(lookup, member.species, level);
    const extraMoves = member.tms
      .map((id) => machineById[id])
      .filter((machine) => machine.from <= stopIndex && data.species[stage.id].tm.includes(machine.move))
      .map((machine) => machine.move);
    present.push({ index: i, member: { species: member.species, extraMoves } });
  });
  return present;
}

function rateRoad(members) {
  return data.stops.map((stop, stopIndex) => {
    const present = members(stopIndex, stop.level);
    const result = teamMatchup(lookup, present.map((entry) => entry.member), stop.level, partyFor(stop));
    return { stop, stopIndex, present, result };
  });
}

function strip(road) {
  return `<span class="strip">${road.map(({ stop, result }) =>
    `<i class="cell ${result.verdict} ${stop.kind}" title="${esc(stop.title)}: ${VERDICT[result.verdict]}"></i>`).join("")}</span>`;
}

function tally(road) {
  const count = (verdict) => road.filter(({ result }) => result.verdict === verdict).length;
  return `${count("easy")} EASY · ${count("fair")} FAIR · ${count("tough")} TOUGH`;
}

function memberCard(member, i) {
  const line = lineOf(member.species);
  const learnable = new Set(line.flatMap((form) => data.species[form].tm));
  const options = data.machines
    .filter((machine) => learnable.has(machine.move) && !member.tms.includes(machine.id))
    .map((machine) => `<option value="${machine.id}">${esc(machine.name)} ${esc(data.moves[machine.move].name)} · ${esc(stopLabel(machine.from))}</option>`)
    .join("");
  const joins = i === 0 ? "Your starter" : `Joins ${esc(stopLabel(joinsAt(member, i)))}`;
  return `<li class="member">
    <a href="/pokemon/${member.species}/">${sprite(member.species)}</a>
    <div class="member-text">
      <b>${esc(name(member.species))}</b>
      <small>${joins}${line.length > 1 ? ` · becomes ${esc(name(line[line.length - 1]))}` : ""}</small>
      <span class="tms">${member.tms.map((id) =>
        `<button type="button" class="chip" data-remove-tm="${i}:${id}" title="Remove">${esc(machineById[id].name)} ${esc(data.moves[machineById[id].move].name)} ✕</button>`).join("")}</span>
      <select data-add-tm="${i}" aria-label="Teach ${esc(name(member.species))} a TM"><option value="">+ TEACH A TM</option>${options}</select>
    </div>
    ${i === 0 ? "" : `<button type="button" class="remove" data-remove="${i}" aria-label="Remove ${esc(name(member.species))}">✕</button>`}
  </li>`;
}

function addSlot() {
  const taken = new Set(state.members.map((member) => member.species));
  const groups = new Map();
  for (const [species, from] of Object.entries(data.catchable)) {
    if (taken.has(species) || lineOf(state.starter).includes(species)) continue;
    if (!groups.has(from)) groups.set(from, []);
    groups.get(from).push(species);
  }
  return `<li class="member empty"><select data-add aria-label="Add a Pokémon"><option value="">+ ADD A POKÉMON</option>${[...groups]
    .map(([from, list]) => `<optgroup label="${esc(stopLabel(from).toUpperCase())}">${list
      .sort((a, b) => name(a).localeCompare(name(b)))
      .map((species) => `<option value="${species}">${esc(name(species))}</option>`).join("")}</optgroup>`)
    .join("")}</select></li>`;
}

function stopRow({ stop, stopIndex, present, result }) {
  const lead = present[result.lead];
  const weak = result.counters[result.weakest];
  const party = partyFor(stop);
  const leadStage = lead ? result.members[result.lead].stage : null;
  return `<li class="stop ${stop.kind} ${result.verdict}">
    <details>
      <summary>
        <span class="meta"><span>${esc(stop.place)}</span><span class="verdict">${VERDICT[result.verdict]}</span></span>
        <span class="who">${esc(stop.title)}</span>
        <span class="plan-line">${lead ? `LEAD WITH <b>${esc(name(leadStage))}</b>` : ""}${weak.edge < 1
          ? ` · WATCH OUT FOR <b>${esc(name(party[result.weakest].species))}</b>` : " · EVERY OPPONENT HAS AN ANSWER"}</span>
        <span class="toggle"></span>
      </summary>
      <ul class="rows">${result.counters.map((counter, i) => {
        const opponent = party[i];
        const member = result.members[counter.member];
        const you = counter.matchup.you;
        const it = counter.matchup.it;
        return `<li><b class="vs">${esc(name(opponent.species))} Lv${opponent.level}</b>
          <span class="hit ${you && you.multiplier > 1 ? "up" : you && you.multiplier < 1 ? "down" : ""}">${esc(name(member.stage))}: ${you ? `${esc(data.moves[you.move].name)} <b>${multiplier(you.multiplier)}</b>` : "no attacks"}</span>
          <span class="hit ${it && it.multiplier > 1 ? "up" : it && it.multiplier < 1 ? "down" : ""}">TAKES: ${it ? `${esc(data.moves[it.move].name)} <b>${multiplier(it.multiplier)}</b>` : "nothing"}</span></li>`;
      }).join("")}</ul>
      <p class="assume">${present.length} on your team by now, all at Lv ${stop.level}.</p>
    </details>
  </li>`;
}

function render() {
  document.body.dataset.starter = state.starter;
  const team = rateRoad(teamAt);
  const alone = rateRoad((stopIndex, level) => teamAt(stopIndex, level).filter((entry) => entry.index === 0));
  root.innerHTML = `
    <nav class="starter-switch" aria-label="Starter">${STARTERS.map((starter) =>
      `<button type="button" data-starter-pick="${starter}" aria-pressed="${starter === state.starter}">${sprite(starter)}<span>${esc(name(starter))}</span></button>`).join("")}</nav>
    <section class="panel">
      <h2>YOUR TEAM</h2>
      <ul class="team-slots">${state.members.map(memberCard).join("")}${state.members.length < 6 ? addSlot() : ""}</ul>
      <p class="actions">
        <button type="button" data-preset>FORESIGHT TEAM</button>
        <button type="button" data-clear>CLEAR</button>
        <button type="button" data-copy>COPY LINK</button>
      </p>
    </section>
    <section class="panel compare">
      <h2>THE ROAD</h2>
      <p><b>YOUR TEAM</b> · ${tally(team)}</p>${strip(team)}
      <p><b>${esc(name(state.starter))} ALONE</b> · ${tally(alone)}</p>${strip(alone)}
      <p class="assume">A fight is EASY when every opponent has a clear answer on your team, and TOUGH when one has none. Members join when you can first catch them, and TMs count once you can get them.</p>
    </section>
    <ol class="stops">${team.map(stopRow).join("")}</ol>`;
  writeHash();
}

root.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.starterPick) {
    const starter = target.dataset.starterPick;
    state = { starter, members: [{ species: starter, tms: [] }, ...state.members.slice(1).filter((member) => !lineOf(starter).includes(member.species))] };
  } else if (target.dataset.remove) {
    state.members.splice(Number(target.dataset.remove), 1);
  } else if (target.dataset.removeTm) {
    const [i, id] = target.dataset.removeTm.split(":");
    state.members[Number(i)].tms = state.members[Number(i)].tms.filter((tm) => tm !== id);
  } else if ("preset" in target.dataset) {
    state.members = [state.members[0], ...data.presets[state.starter].map((species) => ({ species, tms: [] }))];
  } else if ("clear" in target.dataset) {
    state.members = [{ species: state.starter, tms: [] }];
  } else if ("copy" in target.dataset) {
    try {
      await navigator.clipboard.writeText(location.href);
      target.textContent = "COPIED!";
    } catch {
      target.textContent = "COPY THE ADDRESS BAR";
    }
    return;
  } else return;
  render();
});

root.addEventListener("change", (event) => {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement) || !select.value) return;
  if ("add" in select.dataset && state.members.length < 6) {
    state.members.push({ species: select.value, tms: [] });
  } else if (select.dataset.addTm) {
    state.members[Number(select.dataset.addTm)].tms.push(select.value);
  } else return;
  render();
});

if (!location.hash) {
  let saved = "";
  try { saved = localStorage.getItem("planner") ?? ""; } catch { /* Private mode is fine. */ }
  history.replaceState(null, "", `#${saved || "treecko"}`);
}
readHash();
render();
addEventListener("hashchange", () => { readHash(); render(); });
