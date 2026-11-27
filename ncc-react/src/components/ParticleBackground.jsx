import { useEffect, useRef } from "react";

const PALETTE = [
  "217, 167, 66",  // Cadet Gold
  "231, 188, 98",  // Soft Gold
  "143, 166, 104", // Olive Light
  "92, 111, 64"    // Olive Khaki
];

function getTargetCount(width, height) {
  const area = width * height;
  if (width < 640) {
    return Math.min(60, Math.max(40, Math.round(area / 6200)));
  }
  if (width < 1024) {
    return Math.min(100, Math.max(65, Math.round(area / 8800)));
  }
  return Math.min(150, Math.max(100, Math.round(area / 9800)));
}

function createParticles(width, height) {
  const count = getTargetCount(width, height);
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.08 + Math.random() * 0.22;
    items.push({
      hx: x,
      hy: y,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      isDash: i % 3 === 0,
      size: 1.2 + Math.random() * 1.6,
      dashLen: 5 + Math.random() * 6,
      alpha: 0.22 + Math.random() * 0.45,
      color: PALETTE[i % PALETTE.length]
    });
  }
  return items;
}

export default function ParticleBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles = createParticles(width, height);

    const pointer = {
      x: -9999,
      y: -9999,
      active: false
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createParticles(width, height);
      if (reducedMotion) {
        drawFrame(0);
      }
    };

    const drawFrame = (dtFactor) => {
      // Deep navy gradient backdrop
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#08121e");
      grad.addColorStop(0.55, "#0d1b2a");
      grad.addColorStop(1, "#14283e");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const radius = width < 640 ? 96 : 130;
      const radiusSq = radius * radius;
      const maxPush = width < 640 ? 34 : 48;

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];

        if (!reducedMotion && dtFactor > 0) {
          p.hx += p.vx * dtFactor;
          p.hy += p.vy * dtFactor;

          if (p.hx < -16) {
            p.hx = width + 16;
            p.x = p.hx;
          } else if (p.hx > width + 16) {
            p.hx = -16;
            p.x = p.hx;
          }
          if (p.hy < -16) {
            p.hy = height + 16;
            p.y = p.hy;
          } else if (p.hy > height + 16) {
            p.hy = -16;
            p.y = p.hy;
          }

          let targetX = p.hx;
          let targetY = p.hy;

          if (pointer.active) {
            const dx = p.hx - pointer.x;
            const dy = p.hy - pointer.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > 0.01 && distSq < radiusSq) {
              const dist = Math.sqrt(distSq);
              const strength = (1 - dist / radius) * maxPush;
              targetX += (dx / dist) * strength;
              targetY += (dy / dist) * strength;
            }
          }

          const ease = Math.min(1, 0.085 * dtFactor);
          p.x += (targetX - p.x) * ease;
          p.y += (targetY - p.y) * ease;
        }

        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.strokeStyle = `rgba(${p.color}, ${p.alpha})`;

        if (p.isDash) {
          const half = p.dashLen * 0.5;
          const cos = Math.cos(p.angle);
          const sin = Math.sin(p.angle);
          ctx.lineWidth = p.size;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x - cos * half, p.y - sin * half);
          ctx.lineTo(p.x + cos * half, p.y + sin * half);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    let rafId = 0;
    let lastTime = 0;
    const minFrameMs = 1000 / 60;

    const loop = (now) => {
      if (reducedMotion || document.hidden) {
        rafId = 0;
        return;
      }
      if (!lastTime) lastTime = now;
      const elapsed = now - lastTime;
      if (elapsed >= minFrameMs - 0.5) {
        const dtFactor = Math.min(2.5, elapsed / 16.6667);
        lastTime = now;
        drawFrame(dtFactor);
      }
      rafId = window.requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (reducedMotion || document.hidden || rafId) return;
      lastTime = 0;
      rafId = window.requestAnimationFrame(loop);
    };

    const stopLoop = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onPointerMove = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const onTouchStartOrMove = (e) => {
      if (e.touches && e.touches.length > 0) {
        pointer.x = e.touches[0].clientX;
        pointer.y = e.touches[0].clientY;
        pointer.active = true;
      }
    };

    const onTouchEnd = () => {
      pointer.active = false;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else if (reducedMotion) {
        drawFrame(0);
      } else {
        startLoop();
      }
    };

    const onMotionChange = (e) => {
      reducedMotion = e.matches;
      if (reducedMotion) {
        stopLoop();
        drawFrame(0);
      } else {
        startLoop();
      }
    };

    resize();
    if (reducedMotion) {
      drawFrame(0);
    } else {
      startLoop();
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("touchstart", onTouchStartOrMove, { passive: true });
    window.addEventListener("touchmove", onTouchStartOrMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      stopLoop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("touchstart", onTouchStartOrMove);
      window.removeEventListener("touchmove", onTouchStartOrMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[-1] h-full w-full"
        aria-hidden="true"
      />
      {/* Soft dark readability scrim so cards and headings stay crisp */}
      <div
        className="pointer-events-none fixed inset-0 z-[-1] bg-[radial-gradient(circle_at_50%_18%,rgba(13,27,42,0.18),rgba(8,18,30,0.58))]"
        aria-hidden="true"
      />
    </>
  );
}
