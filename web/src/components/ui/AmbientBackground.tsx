import { memo } from "react";
import { useUiStore } from "../../stores/uiStore";

const AmbientBackground = memo(function AmbientBackground() {
  const theme = useUiStore((s) => s.theme);

  // Only render in dark mode
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (!isDark) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* Noise texture overlay */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.02,
        }}
      >
        <filter id="ambient-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#ambient-noise)" />
      </svg>

      {/* Aurora bands at top */}
      <div
        style={{
          position: "absolute",
          top: "-50%",
          left: 0,
          right: 0,
          height: 600,
          perspective: 1000,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.4,
            background:
              "linear-gradient(180deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.12) 40%, transparent 100%)",
            animation: "aurora 8s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.3,
            background:
              "linear-gradient(180deg, rgba(6,182,212,0.15) 0%, rgba(99,102,241,0.08) 50%, transparent 100%)",
            animation: "aurora 12s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Mesh gradient orbs */}
      <div style={{ position: "absolute", inset: 0 }}>
        {/* Indigo orb */}
        <div
          style={{
            position: "absolute",
            width: "40vw",
            height: "40vw",
            top: "10%",
            left: "-10%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
            filter: "blur(80px)",
            animation: "ambient-float 18s ease-in-out infinite",
          }}
        />
        {/* Violet orb */}
        <div
          style={{
            position: "absolute",
            width: "35vw",
            height: "35vw",
            top: "50%",
            right: "-5%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
            filter: "blur(80px)",
            animation: "ambient-float 20s ease-in-out infinite 2s",
          }}
        />
        {/* Cyan orb */}
        <div
          style={{
            position: "absolute",
            width: "30vw",
            height: "30vw",
            bottom: "5%",
            left: "20%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)",
            filter: "blur(80px)",
            animation: "ambient-float 25s ease-in-out infinite 4s",
          }}
        />
        {/* Pink accent orb */}
        <div
          style={{
            position: "absolute",
            width: "25vw",
            height: "25vw",
            top: "30%",
            left: "50%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)",
            filter: "blur(80px)",
            animation: "ambient-float 22s ease-in-out infinite 6s",
          }}
        />
      </div>
    </div>
  );
});

export default AmbientBackground;
