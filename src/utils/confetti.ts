/**
 * Zero-dependency, lightweight canvas confetti burst.
 * Creates a celebratory burst of colorful particles that automatically cleans itself up.
 */
export function triggerConfetti(options?: { count?: number; originX?: number; originY?: number }) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const count = options?.count ?? 55;
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "99999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const startX = options?.originX ?? window.innerWidth / 2;
  const startY = options?.originY ?? window.innerHeight * 0.35;

  // Festive school palette: Emerald, Gold, Sapphire Blue, Crimson, Violet
  const colors = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4"];

  const particles = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 9 + 4;
    return {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4, // slight upward bias
      size: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)] || "#10b981",
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      shape: Math.random() > 0.4 ? "rect" : "circle",
    };
  });

  const startTime = performance.now();
  const duration = 1800; // 1.8 seconds

  function animate(now: number) {
    const elapsed = now - startTime;
    const progress = elapsed / duration;

    if (progress >= 1 || !ctx) {
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28; // gravity
      p.vx *= 0.985; // friction
      p.rotation += p.rotationSpeed;
      p.opacity = Math.max(0, 1 - Math.pow(progress, 1.5));

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.7);
      }

      ctx.restore();
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
