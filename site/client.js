(() => {
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private mode is fine. */ } },
  };
  const nav = [...document.querySelectorAll("[data-nav]")];
  const isHome = document.body.classList.contains("home");

  let soundOn = store.get("sound") === "on";
  let audio;
  const blip = (frequency, length = 0.05, delay = 0) => {
    if (!soundOn) return;
    audio ??= new AudioContext();
    const start = audio.currentTime + delay;
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.type = "square";
    tone.frequency.value = frequency;
    gain.gain.value = 0.025;
    tone.connect(gain).connect(audio.destination);
    tone.start(start);
    tone.stop(start + length);
  };
  const confirmSound = () => { blip(660); blip(990, 0.08, 0.06); };

  const soundButton = document.querySelector("[data-sound]");
  const showSound = () => {
    soundButton.textContent = `SOUND: ${soundOn ? "ON" : "OFF"}`;
    soundButton.setAttribute("aria-pressed", String(soundOn));
  };
  showSound();
  soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    store.set("sound", soundOn ? "on" : "off");
    showSound();
    confirmSound();
  });

  const move = (step) => {
    if (!nav.length) return false;
    const current = nav.indexOf(document.activeElement);
    const next = current < 0 ? (step > 0 ? 0 : nav.length - 1) : (current + step + nav.length) % nav.length;
    nav[next].focus({ preventScroll: true });
    nav[next].scrollIntoView({ block: "center" });
    blip(440);
    return true;
  };

  addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest?.("input, textarea, select")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "j") {
      if (move(1)) event.preventDefault();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "k") {
      if (move(-1)) event.preventDefault();
    } else if (event.key === "Escape") {
      document.querySelector("[data-home]")?.click();
    } else if (event.key === "Enter" && nav.includes(document.activeElement)) {
      confirmSound();
    }
  });

  for (const item of nav) item.addEventListener("click", confirmSound);

  if (isHome) {
    const last = store.get("starter");
    const first = nav.find((item) => item.dataset.pick === last) ?? nav[0];
    if (matchMedia("(hover: hover)").matches) first.focus({ preventScroll: true });
    for (const item of nav) {
      item.addEventListener("mouseenter", () => {
        if (document.activeElement !== item) blip(440);
        item.focus({ preventScroll: true });
      });
      item.addEventListener("click", () => store.set("starter", item.dataset.pick));
    }
  }
})();
