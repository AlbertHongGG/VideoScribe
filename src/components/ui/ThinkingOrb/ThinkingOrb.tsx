import React, { useRef, useEffect } from "react";
import { ThinkingOrbProps } from "./types";
import { getOrbStrategy } from "./strategies";
import { resolveContinuousOptions } from "./math";

export const ThinkingOrb: React.FC<ThinkingOrbProps> = ({
  state = "composing",
  size = 120,
  theme = "dark",
  speed = 1,
  paused = false,
  style,
  className,
  ...rest
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(3, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const isDark = theme === "dark" || (theme === "auto" && true);
    const strategy = getOrbStrategy(state);
    const options = resolveContinuousOptions(state, size);
    const effectiveSpeed = strategy.defaultSpeed * speed;

    let animId = 0;
    let isRunning = false;
    let isVisible = true;

    const renderFrame = (timestamp: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      strategy.paint(ctx, size, (timestamp / 1000) * effectiveSpeed, isDark, options);
      if (isRunning) {
        animId = requestAnimationFrame(renderFrame);
      }
    };

    const start = () => {
      if (!isRunning && !paused) {
        isRunning = true;
        animId = requestAnimationFrame(renderFrame);
      }
    };

    const stop = () => {
      isRunning = false;
      cancelAnimationFrame(animId);
    };

    // Draw initial frame
    renderFrame(performance.now());

    // Observe visibility for 0% CPU consumption when idle
    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          isVisible = entry.isIntersecting;
          if (isVisible && document.visibilityState !== "hidden") {
            start();
          } else {
            stop();
          }
        })
      : null;

    if (observer) {
      observer.observe(canvas);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else if (isVisible) {
        start();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (!observer) {
      start();
    }

    return () => {
      stop();
      if (observer) observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state, size, theme, speed, paused]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={state}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "block",
        ...style,
      }}
      {...rest}
    />
  );
};
