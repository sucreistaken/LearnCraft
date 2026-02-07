import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConceptConnection } from "../types";
import { useConnectionsStore } from "../stores/connectionsStore";
import { useLessonStore } from "../stores/lessonStore";
import { useUiStore } from "../stores/uiStore";

// ─── Helpers ────────────────────────────────────────────

function strengthClass(s: number) {
  if (s >= 0.7) return "conn-strength--high";
  if (s >= 0.4) return "conn-strength--mid";
  return "conn-strength--low";
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// ─── StatsSummary ───────────────────────────────────────

function StatsSummary({ connections }: { connections: ConceptConnection[] }) {
  const stats = useMemo(() => {
    if (connections.length === 0) {
      return { total: 0, avgStrength: 0, mostConnected: "—", strongestBridge: "—" };
    }

    const avgStrength = connections.reduce((s, c) => s + c.strength, 0) / connections.length;

    // Most connected lesson: lesson appearing in the most connections
    const lessonCount = new Map<string, number>();
    for (const c of connections) {
      for (const title of c.lessonTitles) {
        lessonCount.set(title, (lessonCount.get(title) || 0) + 1);
      }
    }
    let mostConnected = "—";
    let maxCount = 0;
    for (const [title, count] of lessonCount) {
      if (count > maxCount) {
        maxCount = count;
        mostConnected = title.length > 25 ? title.slice(0, 25) + "..." : title;
      }
    }

    // Strongest bridge: concept with highest strength
    const strongest = connections[0];
    const strongestBridge = strongest
      ? (strongest.concept.length > 25 ? strongest.concept.slice(0, 25) + "..." : strongest.concept)
      : "—";

    return {
      total: connections.length,
      avgStrength: Math.round(avgStrength * 100),
      mostConnected,
      strongestBridge,
    };
  }, [connections]);

  return (
    <div className="conn-stats-row">
      <div className="conn-stat-card">
        <div className="conn-stat-card__value">{stats.total}</div>
        <div className="conn-stat-card__label">Total Concepts</div>
      </div>
      <div className="conn-stat-card">
        <div className="conn-stat-card__value">{stats.avgStrength}%</div>
        <div className="conn-stat-card__label">Avg Strength</div>
      </div>
      <div className="conn-stat-card">
        <div className="conn-stat-card__value">{stats.mostConnected}</div>
        <div className="conn-stat-card__label">Most Connected</div>
      </div>
      <div className="conn-stat-card">
        <div className="conn-stat-card__value">{stats.strongestBridge}</div>
        <div className="conn-stat-card__label">Strongest Bridge</div>
      </div>
    </div>
  );
}

// ─── FilterToolbar ──────────────────────────────────────

function FilterToolbar({ connections }: { connections: ConceptConnection[] }) {
  const {
    searchQuery, setSearchQuery,
    minStrength, setMinStrength,
    selectedLessonFilter, setLessonFilter,
    sortMode, setSortMode,
  } = useConnectionsStore();

  // Unique lessons from all connections
  const uniqueLessons = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of connections) {
      c.lessonIds.forEach((id, i) => {
        if (!map.has(id)) map.set(id, c.lessonTitles[i] || id);
      });
    }
    return Array.from(map.entries());
  }, [connections]);

  return (
    <div className="conn-toolbar">
      <input
        type="text"
        className="conn-search-input"
        placeholder="Search concepts..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="conn-toolbar__group">
        <label className="conn-toolbar__label">
          Min: {Math.round(minStrength * 100)}%
        </label>
        <input
          type="range"
          className="conn-strength-slider"
          min={0}
          max={100}
          value={Math.round(minStrength * 100)}
          onChange={(e) => setMinStrength(Number(e.target.value) / 100)}
        />
      </div>
      <select
        className="conn-search-input"
        value={selectedLessonFilter || ""}
        onChange={(e) => setLessonFilter(e.target.value || null)}
        style={{ maxWidth: 180 }}
      >
        <option value="">All Lessons</option>
        {uniqueLessons.map(([id, title]) => (
          <option key={id} value={id}>
            {title.length > 30 ? title.slice(0, 30) + "..." : title}
          </option>
        ))}
      </select>
      <div className="view-toggle" style={{ marginLeft: "auto" }}>
        {(["strength", "alpha", "lesson-count"] as const).map((mode) => (
          <button
            key={mode}
            className={`view-toggle__btn${sortMode === mode ? " view-toggle__btn--active" : ""}`}
            onClick={() => setSortMode(mode)}
          >
            {mode === "strength" ? "Strength" : mode === "alpha" ? "A-Z" : "# Lessons"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ListView ───────────────────────────────────────────

function ListView({
  connections,
  selectedConcept,
  onSelect,
}: {
  connections: ConceptConnection[];
  selectedConcept: string | null;
  onSelect: (concept: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {connections.map((conn, i) => (
        <div
          key={i}
          className={`conn-card${selectedConcept === conn.concept ? " conn-card--selected" : ""}`}
          onClick={() => onSelect(conn.concept)}
          style={{ cursor: "pointer" }}
        >
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

// ─── GraphView ──────────────────────────────────────────

type GraphLimit = 20 | 50 | "all";

function GraphView({
  connections,
  selectedConcept,
  onSelect,
}: {
  connections: ConceptConnection[];
  selectedConcept: string | null;
  onSelect: (concept: string) => void;
}) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showLimit, setShowLimit] = useState<GraphLimit>(20);

  const visibleConnections = useMemo(() => {
    if (showLimit === "all") return connections;
    return connections.slice(0, showLimit);
  }, [connections, showLimit]);

  const { nodes, edges } = useMemo(() => {
    const lessonSet = new Map<string, { x: number; y: number; title: string }>();
    const conceptNodes: Array<{
      concept: string; fullConcept: string; x: number; y: number;
      strength: number; lessonIds: string[];
    }> = [];
    const edgeList: Array<{
      from: { x: number; y: number }; to: { x: number; y: number };
      strength: number; conceptName: string;
    }> = [];

    const allLessons = new Map<string, string>();
    for (const conn of visibleConnections) {
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

    visibleConnections.forEach((conn) => {
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

      // Deterministic jitter based on concept hash
      const h = hashCode(conn.concept);
      const jitter = 30;
      avgX += ((((h & 0xffff) / 0xffff) * 2) - 1) * jitter;
      avgY += (((((h >> 16) & 0xffff) / 0xffff) * 2) - 1) * jitter;

      conceptNodes.push({
        concept: conn.concept.length > 25 ? conn.concept.slice(0, 25) + "..." : conn.concept,
        fullConcept: conn.concept,
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
            conceptName: conn.concept,
          });
        }
      }
    });

    return {
      nodes: { lessons: Array.from(lessonSet.entries()), concepts: conceptNodes },
      edges: edgeList,
    };
  }, [visibleConnections]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((t) => {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.3, Math.min(3, t.scale + delta));
      return { ...t, scale: newScale };
    });
  }, []);

  const zoom = useCallback((delta: number) => {
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.3, Math.min(3, t.scale + delta)),
    }));
  }, []);

  const resetZoom = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

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
    <div className="conn-graph-wrap" style={{ position: "relative" }}>
      <div className="conn-graph-controls">
        <button className="btn btn--sm" onClick={() => zoom(0.2)}>+</button>
        <button className="btn btn--sm" onClick={() => zoom(-0.2)}>−</button>
        <button className="btn btn--sm" onClick={resetZoom}>Reset</button>
        <select
          className="conn-search-input"
          value={String(showLimit)}
          onChange={(e) => setShowLimit(e.target.value === "all" ? "all" : Number(e.target.value) as 20 | 50)}
          style={{ width: 80, padding: "3px 6px", fontSize: 11 }}
        >
          <option value="20">Top 20</option>
          <option value="50">Top 50</option>
          <option value="all">All</option>
        </select>
      </div>

      <svg
        width="600" height="500" viewBox="0 0 600 500"
        style={{ width: "100%", maxWidth: 600 }}
        onWheel={handleWheel}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {edges.map((e, i) => {
            const isSelected = selectedConcept === e.conceptName;
            const anySelected = selectedConcept !== null;
            return (
              <line
                key={`e-${i}`}
                x1={e.from.x} y1={e.from.y}
                x2={e.to.x} y2={e.to.y}
                stroke={isSelected ? "var(--accent-2)" : "var(--border)"}
                strokeWidth={1 + e.strength * 2}
                opacity={anySelected ? (isSelected ? 0.9 : 0.15) : 0.3 + e.strength * 0.4}
                style={{ transition: "opacity 0.2s ease, stroke 0.2s ease" }}
              />
            );
          })}

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
          {nodes.concepts.map((n, i) => {
            const isSelected = selectedConcept === n.fullConcept;
            return (
              <g key={`c-${i}`}>
                <circle
                  cx={n.x} cy={n.y}
                  r={5 + n.strength * 8}
                  fill={isSelected ? "var(--accent-2)" : "var(--warning)"}
                  opacity={isSelected ? 1 : 0.6 + n.strength * 0.4}
                  stroke={isSelected ? "var(--text)" : "none"}
                  strokeWidth={2}
                  style={{ cursor: "pointer", transition: "all 0.2s ease" }}
                  onClick={() => onSelect(n.fullConcept)}
                  onMouseEnter={(e) => {
                    setHoveredNode(n.fullConcept);
                    const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top - 30,
                        text: `${n.fullConcept} | ${Math.round(n.strength * 100)}% | ${n.lessonIds.length} lesson(s)`,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredNode(null);
                    setTooltip(null);
                  }}
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
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="conn-graph-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

// ─── ConnectionDetailPanel ──────────────────────────────

function ConnectionDetailPanel({
  connection,
  onClose,
}: {
  connection: ConceptConnection;
  onClose: () => void;
}) {
  const { deepDiveResult, deepDiveLoading, deepDiveConcept, setSelectedConcept } = useConnectionsStore();
  const setCurrentLessonId = useLessonStore((s) => s.setCurrentLessonId);
  const setMode = useUiStore((s) => s.setMode);
  const allLessons = useLessonStore((s) => s.lessons);

  const handleLessonClick = useCallback((title: string) => {
    const lesson = allLessons.find((l) => l.title === title);
    if (lesson) {
      setCurrentLessonId(lesson.id);
      setMode("plan");
    }
  }, [allLessons, setCurrentLessonId, setMode]);

  const handleDeepDive = useCallback(() => {
    deepDiveConcept(connection.concept, connection.lessonTitles, connection.relatedConcepts);
  }, [deepDiveConcept, connection]);

  return (
    <>
      {/* Overlay */}
      <motion.div
        className="conn-detail-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="conn-detail-panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
      >
        <div className="conn-detail-panel__header">
          <div>
            <h3 className="conn-detail-panel__title">{connection.concept}</h3>
            <span className={`conn-strength ${strengthClass(connection.strength)}`}>
              {Math.round(connection.strength * 100)}% strength
            </span>
          </div>
          <button className="btn btn--sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* AI Insight */}
        {connection.aiInsight && (
          <div className="conn-detail-panel__section">
            <h4 className="conn-detail-panel__section-title">AI Insight</h4>
            <div className="conn-insight">{connection.aiInsight}</div>
          </div>
        )}

        {/* Lessons */}
        <div className="conn-detail-panel__section">
          <h4 className="conn-detail-panel__section-title">
            Appears in {connection.lessonTitles.length} lesson(s)
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {connection.lessonTitles.map((title, i) => (
              <button
                key={i}
                className="conn-lesson-tag"
                onClick={() => handleLessonClick(title)}
                style={{ cursor: "pointer", textAlign: "left", display: "block", maxWidth: "100%" }}
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        {/* Related Concepts */}
        {connection.relatedConcepts.length > 0 && (
          <div className="conn-detail-panel__section">
            <h4 className="conn-detail-panel__section-title">Related Concepts</h4>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {connection.relatedConcepts.map((rc, i) => (
                <button
                  key={i}
                  className="conn-lesson-tag"
                  onClick={() => setSelectedConcept(rc)}
                  style={{ cursor: "pointer" }}
                >
                  {rc}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Deep Dive */}
        <div className="conn-detail-panel__section">
          <button
            className="btn"
            onClick={handleDeepDive}
            disabled={deepDiveLoading}
          >
            {deepDiveLoading ? "Analyzing..." : "Deep Dive"}
          </button>

          {deepDiveLoading && (
            <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
              Generating in-depth analysis...
            </div>
          )}

          {deepDiveResult && !deepDiveLoading && (
            <div className="conn-detail-panel__deepdive">
              {deepDiveResult.split("\n").map((p, i) =>
                p.trim() ? <p key={i}>{p}</p> : null
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Main: ConnectionsPane ──────────────────────────────

export default function ConnectionsPane() {
  const store = useConnectionsStore();
  const { connections, loading, error, selectedConcept, setSelectedConcept, fetchConnections, buildConnections } = store;
  const [view, setView] = useState<"list" | "graph">("list");

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const filteredConnections = useMemo(
    () => store.getFilteredConnections(),
    [connections, store.searchQuery, store.minStrength, store.selectedLessonFilter, store.sortMode]
  );

  const selectedConnection = useMemo(
    () => connections.find((c) => c.concept === selectedConcept) || null,
    [connections, selectedConcept]
  );

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
            <button className="btn" onClick={buildConnections} disabled={loading}>
              {loading ? "Building..." : "Build Connections"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: "8px 14px", background: "var(--card-hover)", borderRadius: "var(--radius-sm)", color: "var(--warning)", fontSize: 13, marginBottom: 10 }}>
            {error}
          </div>
        )}

        {/* Stats */}
        {connections.length > 0 && <StatsSummary connections={connections} />}

        {/* Filter Toolbar */}
        {connections.length > 0 && <FilterToolbar connections={connections} />}

        {/* View Toggle */}
        <div className="view-toggle" style={{ marginTop: connections.length > 0 ? 10 : 0 }}>
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
        ) : filteredConnections.length === 0 ? (
          <div className="pane-empty">
            <div className="pane-empty__icon">?</div>
            <div className="pane-empty__title">No matches</div>
            <div className="pane-empty__desc">
              Try adjusting your search or filter criteria.
            </div>
          </div>
        ) : view === "list" ? (
          <ListView
            connections={filteredConnections}
            selectedConcept={selectedConcept}
            onSelect={setSelectedConcept}
          />
        ) : (
          <GraphView
            connections={filteredConnections}
            selectedConcept={selectedConcept}
            onSelect={setSelectedConcept}
          />
        )}
      </section>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedConnection && (
          <ConnectionDetailPanel
            key={selectedConnection.concept}
            connection={selectedConnection}
            onClose={() => setSelectedConcept(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
