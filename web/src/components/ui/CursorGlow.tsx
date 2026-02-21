import { memo, useEffect, useRef, useCallback } from "react";
import { useUiStore } from "../../stores/uiStore";

const CursorGlow = memo(function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const theme = useUiStore((s) => s.theme);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const lerp = useCallback((start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  }, []);

  useEffect(() => {
    if (!isDark) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    const animate = () => {
      if (glowRef.current) {
        currentPos.current.x = lerp(currentPos.current.x, mousePos.current.x, 0.08);
        currentPos.current.y = lerp(currentPos.current.y, mousePos.current.y, 0.08);
        glowRef.current.style.transform = `translate(${currentPos.current.x - 350}px, ${currentPos.current.y - 350}px)`;
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isDark, lerp]);

  if (!isDark) return null;

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 0,
        width: 700,
        height: 700,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 30%, transparent 70%)",
        pointerEvents: "none",
        willChange: "transform",
      }}
    />
  );
});

export default CursorGlow;
