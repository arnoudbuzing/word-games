/**
 * Lightweight canvas confetti shower falling from the top of the screen.
 */

const COLORS = [
  "#2563eb", // Tilewise blue
  "#60a5fa",
  "#e66b19", // Tilewise orange
  "#fb923c",
  "#facc15",
  "#f8fafc",
];

export function launchConfetti({ count = 110, durationMs = 3200 } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "120";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = window.innerWidth;
  let height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * (height * 0.35),
    vx: (Math.random() - 0.5) * 3.2,
    vy: 2.5 + Math.random() * 4.2,
    size: 6 + Math.random() * 6,
    aspect: 0.5 + Math.random() * 0.5,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
    wobble: Math.random() * Math.PI * 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);

    let alive = 0;
    const fadeStart = durationMs * 0.72;
    const globalAlpha =
      elapsed > fadeStart
        ? Math.max(0, 1 - (elapsed - fadeStart) / (durationMs - fadeStart))
        : 1;

    for (const p of particles) {
      p.wobble += 0.08;
      p.x += p.vx + Math.sin(p.wobble) * 0.9;
      p.y += p.vy;
      p.vy += 0.045;
      p.angle += p.spin;

      if (p.y < height + 30 && globalAlpha > 0) {
        alive++;
        ctx.save();
        ctx.globalAlpha = globalAlpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(
          -p.size / 2,
          -(p.size * p.aspect) / 2,
          p.size,
          p.size * p.aspect
        );
        ctx.restore();
      }
    }

    if (alive > 0 && elapsed < durationMs) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(frame);
}
