import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  phase: number;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let stars: Star[] = [];
    let frame = 0;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect?.width ?? 430));
      const height = Math.max(720, Math.floor(rect?.height ?? 900));
      const scale = window.devicePixelRatio || 1;

      canvas.width = width * scale;
      canvas.height = height * scale;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(scale, 0, 0, scale, 0, 0);

      stars = Array.from({ length: 150 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.4 + 0.2,
        alpha: Math.random() * 0.78 + 0.12,
        speed: Math.random() * 0.0048 + 0.0012,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (time: number) => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      context.clearRect(0, 0, width, height);

      for (const star of stars) {
        const pulse = 0.25 + 0.75 * Math.sin(time * star.speed + star.phase);
        context.beginPath();
        context.fillStyle = `rgba(248, 244, 238, ${star.alpha * pulse})`;
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fill();
      }

      frame = requestAnimationFrame(draw);
    };

    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />;
}
