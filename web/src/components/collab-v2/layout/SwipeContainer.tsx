import { useRef } from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo } from "framer-motion";

interface Props {
  activePanel: number;
  onPanelChange: (index: number) => void;
  children: React.ReactNode[];
}

const PANEL_LABELS = ["Sunucular", "Kanallar", "İçerik"];
const DRAG_THRESHOLD = 50;

export default function SwipeContainer({ activePanel, onPanelChange, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const panelCount = children.length;

  // Animate to active panel when it changes externally
  const targetX = -activePanel * window.innerWidth;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    let newPanel = activePanel;
    if (offset < -DRAG_THRESHOLD || velocity < -500) {
      newPanel = Math.min(activePanel + 1, panelCount - 1);
    } else if (offset > DRAG_THRESHOLD || velocity > 500) {
      newPanel = Math.max(activePanel - 1, 0);
    }

    onPanelChange(newPanel);
    animate(x, -newPanel * window.innerWidth, {
      type: "spring",
      stiffness: 300,
      damping: 30,
    });
  };

  // Sync x when activePanel changes programmatically
  const animateToPanel = () => {
    animate(x, targetX, {
      type: "spring",
      stiffness: 300,
      damping: 30,
    });
  };

  // Keep x in sync with activePanel
  if (Math.abs(x.get() - targetX) > 1 && !x.isAnimating()) {
    animateToPanel();
  }

  // Compute drag constraints
  const minX = -(panelCount - 1) * window.innerWidth;

  return (
    <div className="sh-swipe-container" ref={containerRef}>
      {/* Panel indicator dots */}
      <div className="sh-swipe-dots">
        {PANEL_LABELS.map((label, i) => (
          <button
            key={i}
            className={`sh-swipe-dot ${activePanel === i ? "sh-swipe-dot--active" : ""}`}
            onClick={() => {
              onPanelChange(i);
              animate(x, -i * window.innerWidth, {
                type: "spring",
                stiffness: 300,
                damping: 30,
              });
            }}
            title={label}
          >
            <span className="sh-swipe-dot__label">{label}</span>
          </button>
        ))}
      </div>

      {/* Panels */}
      <motion.div
        className="sh-swipe-track"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: minX, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        dragMomentum={false}
      >
        {children.map((child, i) => (
          <div key={i} className="sh-swipe-panel">
            {child}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
