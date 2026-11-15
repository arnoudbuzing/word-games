/**
 * Cute Minion-inspired cartoon mascot ("Tile Buddy") that pops up from
 * the bottom of the screen at the end of each round.
 */

let activeEl = null;
let hideTimer = null;

function buildMascotSvg(won) {
  const mouth = won
    ? `<path d="M 46 86 Q 60 100 74 86 Z" fill="#7f1d1d" stroke="#1f2937" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M 48 86 Q 60 90 72 86" fill="#ffffff"/>
       <path d="M 54 94 Q 60 91 66 94 Q 60 97 54 94 Z" fill="#fb7185"/>`
    : `<path d="M 48 92 Q 54 87 60 91 Q 66 95 72 89" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>`;

  const leftArm = won
    ? `<g class="mascot-arm mascot-arm-left">
         <path d="M 24 106 Q 8 88 12 68" fill="none" stroke="#facc15" stroke-width="10" stroke-linecap="round"/>
         <circle cx="12" cy="66" r="6.5" fill="#1f2937"/>
       </g>`
    : `<g class="mascot-arm">
         <path d="M 24 108 Q 14 120 18 132" fill="none" stroke="#facc15" stroke-width="10" stroke-linecap="round"/>
         <circle cx="18" cy="133" r="6" fill="#1f2937"/>
       </g>`;

  const rightArm = won
    ? `<g class="mascot-arm mascot-arm-right">
         <path d="M 96 106 Q 112 88 108 68" fill="none" stroke="#facc15" stroke-width="10" stroke-linecap="round"/>
         <circle cx="108" cy="66" r="6.5" fill="#1f2937"/>
       </g>`
    : `<g class="mascot-arm">
         <path d="M 96 108 Q 106 120 102 132" fill="none" stroke="#facc15" stroke-width="10" stroke-linecap="round"/>
         <circle cx="102" cy="133" r="6" fill="#1f2937"/>
       </g>`;

  const brows = won
    ? ""
    : `<path d="M 35 42 L 49 46" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>
       <path d="M 85 42 L 71 46" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>`;

  const pupilOffsetY = won ? 0 : 2;

  return `
    <svg class="mascot-svg" viewBox="0 0 120 155" width="112" height="145" aria-hidden="true">
      <defs>
        <linearGradient id="mascot-body-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#fde047"/>
          <stop offset="65%" stop-color="#facc15"/>
          <stop offset="100%" stop-color="#eab308"/>
        </linearGradient>
        <linearGradient id="mascot-denim-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#1d4ed8"/>
        </linearGradient>
      </defs>

      <!-- Spiky hair tufts -->
      <path d="M 48 24 Q 44 10 38 8" fill="none" stroke="#1f2937" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M 55 22 Q 53 7 50 4" fill="none" stroke="#1f2937" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M 61 21 Q 62 6 64 4" fill="none" stroke="#1f2937" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M 67 22 Q 71 8 75 6" fill="none" stroke="#1f2937" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M 73 24 Q 80 12 85 11" fill="none" stroke="#1f2937" stroke-width="2.6" stroke-linecap="round"/>

      <!-- Arms (behind body edge) -->
      ${leftArm}
      ${rightArm}

      <!-- Pill-shaped body -->
      <rect x="24" y="22" width="72" height="122" rx="36" fill="url(#mascot-body-grad)" stroke="#1f2937" stroke-width="2.5"/>

      <!-- Overalls base -->
      <path d="M 24 104 L 96 104 L 96 112 A 36 36 0 0 1 24 112 Z" fill="url(#mascot-denim-grad)" stroke="#1f2937" stroke-width="2.5"/>
      <rect x="24" y="102" width="72" height="42" rx="22" fill="url(#mascot-denim-grad)" stroke="#1f2937" stroke-width="2.5"/>

      <!-- Overall bib & straps -->
      <rect x="38" y="96" width="44" height="22" rx="4" fill="url(#mascot-denim-grad)" stroke="#1f2937" stroke-width="2.2"/>
      <path d="M 25 94 L 41 102 L 45 97 L 27 88 Z" fill="#2563eb" stroke="#1f2937" stroke-width="2" stroke-linejoin="round"/>
      <path d="M 95 94 L 79 102 L 75 97 L 93 88 Z" fill="#2563eb" stroke="#1f2937" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="42" cy="100" r="2.6" fill="#1f2937"/>
      <circle cx="78" cy="100" r="2.6" fill="#1f2937"/>

      <!-- Pocket with mini Tilewise emblem -->
      <path d="M 48 112 L 72 112 L 72 124 Q 60 130 48 124 Z" fill="#1d4ed8" stroke="#1f2937" stroke-width="2"/>
      <rect x="53" y="115" width="6" height="6" rx="1.2" fill="#facc15"/>
      <rect x="61" y="115" width="6" height="6" rx="1.2" fill="#e66b19"/>

      <!-- Goggle strap -->
      <rect x="23" y="54" width="74" height="11" rx="3" fill="#1f2937"/>

      <!-- Left & Right Goggles -->
      <circle cx="45" cy="59" r="15.5" fill="#9ca3af" stroke="#1f2937" stroke-width="2.5"/>
      <circle cx="45" cy="59" r="11.5" fill="#ffffff" stroke="#4b5563" stroke-width="1.5"/>
      <circle cx="46" cy="${59 + pupilOffsetY}" r="5.5" fill="#78350f"/>
      <circle cx="46" cy="${59 + pupilOffsetY}" r="2.8" fill="#111827"/>
      <circle cx="43.5" cy="${56.5 + pupilOffsetY}" r="1.8" fill="#ffffff"/>

      <circle cx="75" cy="59" r="15.5" fill="#9ca3af" stroke="#1f2937" stroke-width="2.5"/>
      <circle cx="75" cy="59" r="11.5" fill="#ffffff" stroke="#4b5563" stroke-width="1.5"/>
      <circle cx="74" cy="${59 + pupilOffsetY}" r="5.5" fill="#78350f"/>
      <circle cx="74" cy="${59 + pupilOffsetY}" r="2.8" fill="#111827"/>
      <circle cx="71.5" cy="${56.5 + pupilOffsetY}" r="1.8" fill="#ffffff"/>

      <!-- Optional worried brows on loss -->
      ${brows}

      <!-- Mouth -->
      ${mouth}
    </svg>
  `;
}

export function hideEndRoundMascot() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (!activeEl) return;

  const el = activeEl;
  activeEl = null;
  el.classList.remove("visible");
  el.classList.add("leaving");
  setTimeout(() => el.remove(), 420);
}

export function showEndRoundMascot({
  won = true,
  points = 0,
  durationMs = 4500,
} = {}) {
  if (typeof document === "undefined") return;

  hideEndRoundMascot();

  const wrapper = document.createElement("button");
  wrapper.type = "button";
  wrapper.className = `end-mascot ${won ? "is-win" : "is-loss"}`;
  wrapper.setAttribute("aria-label", won ? "Round won mascot" : "Round lost mascot");
  wrapper.title = "Click to dismiss";

  const bubbleText = won
    ? points > 0
      ? `Bello! +${points}`
      : "Bello! Nice!"
    : "Aww, next time!";

  wrapper.innerHTML = `
    <span class="mascot-bubble">${bubbleText}</span>
    <span class="mascot-figure">${buildMascotSvg(won)}</span>
  `;

  wrapper.addEventListener("click", () => hideEndRoundMascot());
  document.body.appendChild(wrapper);
  activeEl = wrapper;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (activeEl === wrapper) {
        wrapper.classList.add("visible");
      }
    });
  });

  if (durationMs > 0) {
    hideTimer = setTimeout(() => {
      if (activeEl === wrapper) {
        hideEndRoundMascot();
      }
    }, durationMs);
  }
}
