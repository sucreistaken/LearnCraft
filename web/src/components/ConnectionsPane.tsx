import React, { useEffect, useState, useMemo } from "react";
import { ConceptConnection } from "../types";
import { connectionsApi } from "../services/api";

function strengthClass(s: number) {
  if (s >= 0.7) return "conn-strength--high";
  if (s >= 0.4) return "conn-strength--mid";
  return "conn-strength--low";
}

function ListView({ connections }: { connections: ConceptConnection[] }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {connections.map((conn, i) => (
        <div key={i} className="conn-card">
          <div className="conn-header">
            <span className="conn-concept">{conn.concept}</span>
            <span className={`conn-strength ${strengthClass(conn.strength)}`}>
              {Math.round(conn.strength * 100)}%
            </span>
          </div>

          <div className="conn-lessons">
            {conn.lessonTitles.map((title, j) => (
              <span key={j} className="conn-lesson-tag">
                {title.length > 30 ? title.slice(0, 30) + "..." : title}
              </span>
            ))}
          </div>

          {conn.relatedConcepts.length > 0 && (
            <div className="conn-related">
              Related: {conn.relatedConcepts.slice(0, 3).join(", ")}
            </div>
          )}

          {conn.aiInsight && (
            <div className="conn-insight">{conn.aiInsight}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function GraphView({ connections }: { connections: ConceptConnection[] }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const lessonSet = new Map<string, { x: number; y: number; title: string }>();
    const conceptNodes: Array<{
      concept: string; x: number; y: number; strength: number; lessonIds: string[];
    }> = [];
    const edgeList: Array<{
      from: { x: number; y: number }; to: { x: number; y: number }; strength: number;
    }> = [];

    const allLessons = new Map<string, string>();
    for (const conn of connections) {
      conn.lessonIds.forEach((id, i) => {
        if (!allLessons.has(id)) allLessons.set(id, conn.lessonTitles[i] || id);
      });
    }

    const lessonArray = Array.from(allLessons.entries());
    const cx = 300, cy = 250, radius = 180;
    lessonArray.forEach(([id, title], i) => {
      const angle = (2 * Math.PI * i) / lessonArray.length - Math.PI / 2;
      lessonSet.set(id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        title: title.length > 20 ? title.slice(0, 20) + "..." : title,
      });
    });

    connections.slice(0, 15).forEach((conn) => {
      let avgX = cx, avgY = cy;
      if (conn.lessonIds.length > 0) {
        const positions = conn.lessonIds
          .map((id) => lessonSet.get(id))
          .filter(Boolean) as { x: number; y: number }[];
        if (positions.length > 0) {
          avgX = positions.reduce((a, p) => a + p.x, 0) / positions.length;
          avgY = positions.reduce((a, p) => a + p.y, 0) / positions.length;
        }
      }

      const jitter = 30;
      avgX += (Math.random() - 0.5) * jitter;
      avgY += (Math.random() - 0.5) * jitter;

      conceptNodes.push({
        concept: conn.concept.length > 25 ? conn.concept.slice(0, 25) + "..." : conn.concept,
        x: avgX, y: avgY,
        strength: conn.strength,
        lessonIds: conn.lessonIds,
      });

      for (const lid of conn.lessonIds) {
        const lNode = lessonSet.get(lid);
        if (lNode) {
          edgeList.push({
            from: { x: avgX, y: avgY },
            to: { x: lNode.x, y: lNode.y },
            strength: conn.strength,
          });
        }
      }
    });

    return {
      nodes: { lessons: Array.from(lessonSet.entries()), concepts: conceptNodes },
      edges: edgeList,
    };
  }, [connections]);

  if (connections.length === 0) {
    return (
      <div className="pane-empty">
        <div className="pane-empty__icon">G</div>
        <div className="pane-empty__title">No graph data</div>
        <div className="pane-empty__desc">Build connections first to see the graph.</div>
      </div>
    );
  }

  return (
    <div className="conn-graph-wrap">
      <svg width="600" height="500" viewBox="0 0 600 500" style={{ width: "100%", maxWidth: 600 }}>
        {/* Edges */}
        {edges.map((e, i) => (
          <line
            key={`e-${i}`}
            x1={e.from.x} y1={e.from.y}
            x2={e.to.x} y2={e.to.y}
            stroke="var(--border)"
            strokeWidth={1 + e.strength * 2}
            opacity={0.3 + e.strength * 0.4}
          />
        ))}

        {/* Lesson nodes */}
        {nodes.lessons.map(([id, node]) => (
          <g key={`l-${id}`}>
            <circle
              cx={node.x} cy={node.y} r={22}
              fill="var(--accent-2)"
              opacity={hoveredNode === id ? 1 : 0.85}
              stroke={hoveredNode === id ? "var(--text)" : "none"}
              strokeWidth={2}
              onMouseEnter={() => setHoveredNode(id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: "pointer", transition: "opacity 0.15s ease" }}
            />
            <text
              x={node.x} y={node.y + 34}
              textAnchor="middle" fill="var(--text)"
              fontSize={10} fontWeight={600}
              style={{ pointerEvents: "none" }}
            >
              {node.title}
            </text>
          </g>
        ))}

        {/* Concept nodes */}
        {nodes.concepts.map((n, i) => (
          <g key={`c-${i}`}>
            <circle
              cx={n.x} cy={n.y}
              r={5 + n.strength * 8}
              fill="var(--warning)"
              opacity={0.6 + n.strength * 0.4}
              style={{ transition: "r 0.2s ease" }}
            />
            <text
              x={n.x} y={n.y - 10 - n.strength * 4}
              textAnchor="middle" fill="var(--muted)"
              fontSize={9} fontWeight={500}
              style={{ pointerEvents: "none" }}
            >
              {n.concept}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function ConnectionsPane() {
  const [connections, setConnections] = useState<ConceptConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "graph">("list");

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const res = await connectionsApi.get();
      if (res.ok && res.connections) setConnections(res.connections);
    } catch { }
    setLoading(false);
  };

  const handleBuild = async () => {
    setLoading(true);
    try {
      const res = await connectionsApi.build();
      if (res.ok && res.connections) setConnections(res.connections);
    } catch { }
    setLoading(false);
  };

  return (
    <div className="grid-gap-12">
      <section className="lc-section">
        <div className="pane-header" style={{ marginBottom: 14 }}>
          <div className="pane-header__info">
            <div className="pane-header__title">Cross-Lesson Connections</div>
            <div className="pane-header__desc">
              Discover concepts shared across multiple lessons.
            </div>
          </div>
          <div className="pane-header__actions">
            <button className="btn" onClick={handleBuild} disabled={loading}>
              {loading ? "Building..." : "Build Connections"}
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="view-toggle">
          <button
            className={`view-toggle__btn${view === "list" ? " view-toggle__btn--active" : ""}`}
            onClick={() => setView("list")}
          >
            List View
          </button>
          <button
            className={`view-toggle__btn${view === "graph" ? " view-toggle__btn--active" : ""}`}
            onClick={() => setView("graph")}
          >
            Graph View
          </button>
        </div>
      </section>

      <section className="lc-section">
        {loading ? (
          <div className="pane-empty" style={{ padding: 32 }}>
            <div className="pane-empty__desc">Building connections...</div>
          </div>
        ) : connections.length === 0 ? (
          <div className="pane-empty">
            <div className="pane-empty__icon">C</div>
            <div className="pane-empty__title">No connections yet</div>
            <div className="pane-empty__desc">
              Click "Build Connections" to analyze concepts across your lessons.
            </div>
          </div>
        ) : view === "list" ? (
          <ListView connections={connections} />
        ) : (
          <GraphView connections={connections} />
        )}
      </section>
    </div>
  );
}
