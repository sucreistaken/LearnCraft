// src/components/DeviationPane.tsx
import React from "react";
import { motion } from "framer-motion";

interface DeviationSegment {
    index: number;
    start: string;
    end: string;
    text: string;
    slideCoverage: number;
    banterScore: number;
    status: "on_slide" | "expanded" | "off_slide" | "banter" | "side_topic" | string; // backend bazen string dönebilir
    confidence: number;
    reason: string;
}

interface DeviationSummary {
    totalSegments: number;
    overallScore: number;
    interpretation: string;
    percent: {
        on_slide: number;
        expanded: number;
        off_slide: number;
        banter: number;
        side_topic?: number;
    };
    counts: {
        on_slide: number;
        expanded: number;
        off_slide: number;
        banter: number;
        side_topic?: number;
    };
    missedTopics: string[];
    extraTopics: string[];
    isDeckMismatch?: boolean;
    deckSimilarity?: number;
}

interface DeviationResult {
    summary: DeviationSummary;
    segments: DeviationSegment[];
}

export interface DeviationPaneProps {
    deviation?: DeviationResult & { updatedAt?: number | string };
    loading?: boolean;
    error?: string | null;
    onGenerate?: () => void;
    onReanalyze?: () => void;
}

const statusConfig = {
    on_slide: { label: "Slayta Uygun", color: "#10b981", icon: "✅" },
    expanded: { label: "Genişletilmiş", color: "#3b82f6", icon: "📝" },
    side_topic: { label: "Yan Konu", color: "#8b5cf6", icon: "🔗" },
    off_slide: { label: "Konu Sapması", color: "#f59e0b", icon: "⚠️" },
    banter: { label: "Sohbet/Diğer", color: "#ef4444", icon: "💬" },
};

type StatusKey = keyof typeof statusConfig;

function safeGetStatus(status: any): typeof statusConfig.on_slide {
    const key = (typeof status === "string" ? status : "") as StatusKey;
    return statusConfig[key] || statusConfig.off_slide;
}

function clamp(n: number, a = 0, b = 100) {
    if (Number.isNaN(n)) return a;
    return Math.max(a, Math.min(b, n));
}

/** Basit gauge — dışarıdan ScoreGauge yoksa patlamasın diye buraya aldım */
function ScoreGauge({ score }: { score: number }) {
    const v = clamp(Math.round(score ?? 0), 0, 100);
    const ring = `conic-gradient(#10b981 ${v * 3.6}deg, rgba(255,255,255,0.08) 0deg)`;

    return (
        <div style={{ display: "grid", placeItems: "center" }}>
            <div
                style={{
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    background: ring,
                    display: "grid",
                    placeItems: "center",
                    padding: 10,
                }}
            >
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        background: "var(--bg)",
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid rgba(255,255,255,0.08)",
                    }}
                >
                    <div style={{ textAlign: "center" }}>
                        <div className="fw-800" style={{ fontSize: 26, lineHeight: 1 }}>
                            {v}
                        </div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                            / 100
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: any }) {
    const conf = safeGetStatus(status);
    return (
        <span
            className="pill"
            style={{
                backgroundColor: `${conf.color}15`,
                color: conf.color,
                border: `1px solid ${conf.color}30`,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: "nowrap",
            }}
        >
            <span>{conf.icon}</span>
            <span>{conf.label}</span>
        </span>
    );
}

function formatTime(ts: any) {
    try {
        const d = new Date(ts || Date.now());
        return d.toLocaleTimeString();
    } catch {
        return new Date().toLocaleTimeString();
    }
}

export default function DeviationPane({
    deviation,
    loading = false,
    error = null,
    onGenerate,
    onReanalyze,
}: DeviationPaneProps) {
    const [expandedBlocks, setExpandedBlocks] = React.useState<Set<number>>(new Set());

    const toggleBlock = (index: number) => {
        setExpandedBlocks((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    if (loading) {
        return (
            <div className="lc-section" style={{ padding: 40, textAlign: "center" }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    style={{ fontSize: 40, marginBottom: 16, display: "inline-block" }}
                >
                    ⏳
                </motion.div>
                <h3 className="fw-700 fs-18">Analiz Ediliyor...</h3>
                <p className="text-muted">Hocanın konuşması slaytlarla karşılaştırılıyor.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="lc-section" style={{ padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
                <h3 className="fw-700 fs-18" style={{ color: "#ef4444" }}>
                    Analiz Hatası
                </h3>
                <p className="text-muted mb-4">{String(error)}</p>

                {onGenerate && (
                    <button className="btn btn-primary" onClick={onGenerate}>
                        Tekrar Dene
                    </button>
                )}
            </div>
        );
    }

    if (!deviation) {
        return (
            <div className="lc-section" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <h3 className="fw-700 fs-18">Sapma Analizi</h3>
                <p className="text-muted mb-4" style={{ maxWidth: 400, margin: "0 auto 24px" }}>
                    Yapay zeka ile ders kaydını ve slaytları karşılaştırarak hocanın konuya ne kadar sadık
                    kaldığını ölçün.
                </p>
                {onGenerate && (
                    <button className="btn btn-primary" onClick={onGenerate}>
                        Analizi Başlat
                    </button>
                )}
            </div>
        );
    }

    const summary = deviation.summary;
    const segments = Array.isArray(deviation.segments) ? deviation.segments : [];

    const p = summary?.percent || ({} as any);
    const percentOn = clamp(Number(p.on_slide ?? 0));
    const percentExp = clamp(Number(p.expanded ?? 0));
    const percentSide = clamp(Number(p.side_topic ?? 0));
    const percentOff = clamp(Number(p.off_slide ?? 0));
    const percentBanter = clamp(Number(p.banter ?? 0));

    const relatedPct = clamp(Math.round(percentOn + percentExp));

    return (
        <div className="grid-gap-12">
            {/* --- Summary Section --- */}
            <section className="lc-section">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 16,
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <div className="fw-800 fs-18">Genel Değerlendirme</div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                            Son analiz: {formatTime((deviation as any).updatedAt || Date.now())}
                        </div>
                        {onReanalyze && (
                            <button
                                className="btn btn-ghost"
                                onClick={onReanalyze}
                                style={{ fontSize: 12, padding: "6px 12px" }}
                            >
                                🔄 Yeniden Analiz Et
                            </button>
                        )}
                    </div>
                </div>

                {/* Deck mismatch uyarısı */}
                {summary?.isDeckMismatch && (
                    <div
                        style={{
                            padding: 14,
                            borderRadius: 14,
                            border: "1px solid rgba(245,158,11,0.35)",
                            background: "rgba(245,158,11,0.12)",
                            marginBottom: 16,
                        }}
                    >
                        <div className="fw-800" style={{ color: "#f59e0b", marginBottom: 4 }}>
                            ⚠️ Slayt / Konu Uyumsuzluğu
                        </div>
                        <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                            Transcript ile slaytların ana konusu farklı görünüyor.
                            {typeof summary.deckSimilarity === "number" ? (
                                <>
                                    {" "}
                                    (Deck similarity: <strong>{summary.deckSimilarity.toFixed(2)}</strong>)
                                </>
                            ) : null}
                        </div>
                    </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center" }}>
                    <ScoreGauge score={summary?.overallScore ?? 0} />

                    <div>
                        <h3 className="fw-700 fs-18 mb-2" style={{ color: "var(--text)" }}>
                            {summary?.interpretation || "—"}
                        </h3>
                        <p className="text-muted" style={{ fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
                            Toplam <strong>{summary?.totalSegments ?? segments.length}</strong> segment incelendi.
                            Dersin <strong>%{relatedPct}</strong> kadarı slaytlarla doğrudan ilişkili.
                        </p>

                        <div style={{ display: "flex", gap: 8 }}>
                            <div
                                style={{
                                    flex: 1,
                                    background: "var(--bg)",
                                    height: 8,
                                    borderRadius: 4,
                                    overflow: "hidden",
                                    display: "flex",
                                }}
                            >
                                <div style={{ width: `${percentOn}%`, background: statusConfig.on_slide.color }} />
                                <div style={{ width: `${percentExp}%`, background: statusConfig.expanded.color }} />
                                <div style={{ width: `${percentSide}%`, background: statusConfig.side_topic.color }} />
                                <div style={{ width: `${percentOff}%`, background: statusConfig.off_slide.color }} />
                                <div style={{ width: `${percentBanter}%`, background: statusConfig.banter.color }} />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "var(--muted)", flexWrap: "wrap" }}>
                            <span style={{ color: statusConfig.on_slide.color }}>● Slayta Uygun</span>
                            <span style={{ color: statusConfig.expanded.color }}>● Genişletilmiş</span>
                            <span style={{ color: statusConfig.side_topic.color }}>● Yan Konu</span>
                            <span style={{ color: statusConfig.off_slide.color }}>● Sapma</span>
                            <span style={{ color: statusConfig.banter.color }}>● Sohbet</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- Insight Chips --- */}
            {(summary?.missedTopics?.length > 0 || summary?.extraTopics?.length > 0) && (
                <section className="lc-section">
                    <div className="grid-gap-16">
                        {summary?.missedTopics?.length > 0 && (
                            <div>
                                <div className="fw-700 fs-13 text-muted mb-2 uppercase tracking-wide">❌ Slaytta Olup Değinilmeyenler</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {summary.missedTopics.map((t, i) => (
                                        <span
                                            key={i}
                                            className="pill"
                                            style={{
                                                background: "#fff1f2",
                                                color: "#be123c",
                                                border: "1px solid #fda4af",
                                                padding: "4px 10px",
                                                borderRadius: 999,
                                                fontSize: 12,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {summary?.extraTopics?.length > 0 && (
                            <div>
                                <div className="fw-700 fs-13 text-muted mb-2 uppercase tracking-wide">➕ Slayt Dışı Eklenen Konular</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {summary.extraTopics.map((t, i) => (
                                        <span
                                            key={i}
                                            className="pill"
                                            style={{
                                                background: "#eff6ff",
                                                color: "#1d4ed8",
                                                border: "1px solid #93c5fd",
                                                padding: "4px 10px",
                                                borderRadius: 999,
                                                fontSize: 12,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* --- Timeline Feed --- */}
            <section className="lc-section">
                <div className="fw-800 fs-18 mb-4">Zaman Akışı</div>

                {segments.length === 0 ? (
                    <div className="text-muted" style={{ padding: 16 }}>
                        Segment bulunamadı (API 500 / boş response olabilir).
                    </div>
                ) : (
                    <div className="grid-gap-12">
                        {segments.map((seg, i) => {
                            const conf = safeGetStatus(seg?.status);
                            return (
                                <motion.div
                                    key={seg?.index ?? i}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    style={{
                                        padding: 16,
                                        borderRadius: 16,
                                        background: "var(--bg)",
                                        borderLeft: `4px solid ${conf.color}`, // ✅ burada artık undefined.color patlamaz
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <StatusBadge status={seg?.status} />
                                            <span className="fw-700 text-sm font-mono opacity-60">
                                                {seg?.start || "00:00:00"} - {seg?.end || "00:00:00"}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted">
                                            %{Math.round((Number(seg?.slideCoverage ?? 0) || 0) * 100)} Eşleşme
                                        </div>
                                    </div>

                                    {/* Transcript text with expand/collapse */}
                                    {(() => {
                                        const isExpanded = expandedBlocks.has(seg?.index ?? i);
                                        const text = seg?.text || "—";
                                        const MAX_LENGTH = 200;
                                        const shouldTruncate = text.length > MAX_LENGTH;

                                        return (
                                            <div>
                                                <p
                                                    className="m-0 text-sm"
                                                    style={{
                                                        lineHeight: 1.6,
                                                        maxHeight: isExpanded || !shouldTruncate ? "none" : "4.8em",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: isExpanded || !shouldTruncate ? "unset" : 3,
                                                        WebkitBoxOrient: "vertical",
                                                    }}
                                                >
                                                    {text}
                                                </p>

                                                {shouldTruncate && (
                                                    <button
                                                        onClick={() => toggleBlock(seg?.index ?? i)}
                                                        style={{
                                                            marginTop: 8,
                                                            background: "transparent",
                                                            border: "none",
                                                            color: conf.color,
                                                            cursor: "pointer",
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 4,
                                                            padding: "4px 0",
                                                            transition: "all 0.2s",
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                                                transition: "transform 0.2s",
                                                                display: "inline-block",
                                                            }}
                                                        >
                                                            ↓
                                                        </span>
                                                        {isExpanded ? "Daralt" : "Tümünü Göster"}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
