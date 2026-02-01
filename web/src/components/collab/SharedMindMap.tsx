import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";
import { useLessonStore } from "../../stores/lessonStore";
import { deepDiveApi } from "../../services/api";
import { MindMapAnnotation } from "../../types";
import NodeAnnotations from "./NodeAnnotations";

let mermaidInitialized = false;

const MIN_DRAWER_HEIGHT = 120;
const MAX_DRAWER_HEIGHT = 500;
const DEFAULT_DRAWER_HEIGHT = 280;

export default function SharedMindMap() {
  const workspace = useRoomStore((s) => s.workspace);
  const currentRoom = useRoomStore((s) => s.currentRoom);

  const lessons = useLessonStore((s) => s.lessons);
  const lessonId = currentRoom?.lessonId || "";
  const lesson = lessons.find((l) => l.id === lessonId);

  const [mindmapCode, setMindmapCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [drawerHeight, setDrawerHeight] = useState(DEFAULT_DRAWER_HEIGHT);

  const svgContainerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const annotations = workspace.mindMapAnnotations;

  const annotationsByNode: Record<string, MindMapAnnotation[]> = {};
  annotations.forEach((a) => {
    if (!annotationsByNode[a.nodeLabel]) annotationsByNode[a.nodeLabel] = [];
    annotationsByNode[a.nodeLabel].push(a);
  });

  const loadMindMap = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await deepDiveApi.generateMindMap(lessonId);
      if (res.ok && res.code) {
        setMindmapCode(res.code);
      } else {
        setError(res.error || "Failed to generate mind map");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load mind map");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    loadMindMap();
  }, [loadMindMap]);

  useEffect(() => {
    if (!mindmapCode || !svgContainerRef.current) return;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "base",
            themeVariables: {
              primaryColor: "#ede9fe",
              primaryBorderColor: "#8b5cf6",
              primaryTextColor: "#1e1b4b",
              lineColor: "#a78bfa",
            },
          });
          mermaidInitialized = true;
        }

        const id = `shared-mm-${Date.now()}`;
        const { svg } = await mermaid.render(id, mindmapCode);
        if (svgContainerRef.current) {
          svgContainerRef.current.innerHTML = svg;
          attachNodeHandlers();
        }
      } catch (err: any) {
        console.error("Mermaid render error:", err);
        setError("Failed to render mind map");
      }
    };

    renderMermaid();
  }, [mindmapCode, annotations.length]);

  const attachNodeHandlers = () => {
    if (!svgContainerRef.current) return;
    const nodes = svgContainerRef.current.querySelectorAll(".mindmap-node, .node, g[class*='node']");
    nodes.forEach((node) => {
      const textEl = node.querySelector("text, .nodeLabel, foreignObject");
      const nodeName = textEl?.textContent?.trim() || "";
      if (!nodeName) return;

      const nodeAnnotations = annotationsByNode[nodeName];
      if (nodeAnnotations && nodeAnnotations.length > 0) {
        const existingBadge = node.querySelector(".ann-badge");
        if (!existingBadge) {
          const badge = document.createElementNS("http://www.w3.org/2000/svg", "text");
          badge.textContent = `\uD83D\uDCDD${nodeAnnotations.length}`;
          badge.setAttribute("class", "ann-badge");
          badge.setAttribute("font-size", "10");
          badge.setAttribute("fill", "#6366f1");
          badge.setAttribute("x", "5");
          badge.setAttribute("y", "-5");
          node.appendChild(badge);
        }
      }

      (node as HTMLElement).style.cursor = "pointer";
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedNode(nodeName);
      });

      node.addEventListener("mouseenter", () => {
        const rect = node.querySelector("rect, circle, ellipse, path, polygon");
        if (rect) (rect as HTMLElement).style.stroke = "#6366f1";
      });
      node.addEventListener("mouseleave", () => {
        const rect = node.querySelector("rect, circle, ellipse, path, polygon");
        if (rect) (rect as HTMLElement).style.stroke = "";
      });
    });
  };

  // Drag-to-resize handler
  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = drawerHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = dragStartY.current - ev.clientY;
      const newHeight = Math.min(MAX_DRAWER_HEIGHT, Math.max(MIN_DRAWER_HEIGHT, dragStartHeight.current + delta));
      setDrawerHeight(newHeight);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const uniqueContributors = new Set(annotations.map((a) => a.authorNickname)).size;

  return (
    <div className="ws-mm">
      <div className="ws-mm__main">
        {/* Header */}
        <div className="ws-pane-head">
          <div className="ws-pane-head__icon" style={{ background: "#ede9fe", color: "#8b5cf6" }}>
            {"\uD83D\uDDFA\uFE0F"}
          </div>
          <span className="ws-pane-head__title">Mind Map</span>
          <span className="ws-pane-head__meta">
            {annotations.length} annotations
            {uniqueContributors > 0 && ` \u00B7 ${uniqueContributors} contributor${uniqueContributors !== 1 ? "s" : ""}`}
          </span>
          <div className="ws-pane-head__actions">
            {!mindmapCode && !loading && (
              <button className="btn-small" onClick={loadMindMap}>Generate Mind Map</button>
            )}
            {mindmapCode && (
              <button className="btn-small" onClick={loadMindMap}>Regenerate</button>
            )}
          </div>
        </div>

        {/* Map content */}
        <div className="ws-mm__canvas" onClick={() => setSelectedNode(null)}>
          {loading && (
            <div className="pane-empty">
              <div className="pane-empty__icon">{"\uD83D\uDDFA\uFE0F"}</div>
              <div className="pane-empty__title">Generating mind map...</div>
            </div>
          )}

          {error && !loading && (
            <div className="pane-empty">
              <div className="pane-empty__desc">{error}</div>
              <button className="btn btn-primary" onClick={loadMindMap} style={{ marginTop: 12 }}>
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && !mindmapCode && (
            <div className="pane-empty">
              <div className="pane-empty__icon">{"\uD83D\uDDFA\uFE0F"}</div>
              <div className="pane-empty__title">Mind Map</div>
              <div className="pane-empty__desc">
                Generate a mind map from {currentRoom?.lessonTitle || "the lesson"} and collaboratively annotate nodes.
              </div>
              <button className="btn btn-primary" onClick={loadMindMap} style={{ marginTop: 12 }}>
                Generate Mind Map
              </button>
            </div>
          )}

          <div ref={svgContainerRef} onClick={(e) => e.stopPropagation()} />
        </div>

        {mindmapCode && !selectedNode && (
          <div className="ws-mm__legend">
            <span>{"\uD83D\uDCDD"} = annotations</span>
            <span>Click a node to view or add annotations</span>
          </div>
        )}
      </div>

      {/* Bottom drawer for annotations */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            className="ws-mm-drawer"
            initial={{ height: 0 }}
            animate={{ height: drawerHeight }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="ws-mm-drawer__handle" onMouseDown={handleMouseDown} />
            <NodeAnnotations
              nodeLabel={selectedNode}
              annotations={annotationsByNode[selectedNode] || []}
              onClose={() => setSelectedNode(null)}
              layout="horizontal"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
