import React, { useEffect, useState, useRef, useCallback } from "react";
import mermaid from "mermaid";
import { deepDiveApi } from "../services/api";
import { useLessonStore } from "../stores/lessonStore";
import { motion, AnimatePresence } from "framer-motion";
import { exportToPdf } from "../utils/pdfExport";

interface ModuleInfo {
    id: number;
    title: string;
    topics: string[];
}

interface SavedMindMap {
    code: string;
    title: string;
    savedAt: number;
}

interface NodeDetail {
    title: string;
    explanation?: string;
    keyPoints?: string[];
    relatedConcepts?: string[];
    example?: { scenario: string; explanation: string; takeaway: string };
    quiz?: { question: string; options: string[]; correctAnswer: string; explanation: string };
}

interface LearnedNodes {
    [nodeId: string]: boolean;
}

const STORAGE_KEY_PREFIX = 'lc.mindmap.';
const PROGRESS_KEY_PREFIX = 'lc.mindmap.progress.';

const getStorageKey = (lessonId: string, moduleId: number) =>
    `${STORAGE_KEY_PREFIX}${lessonId}.module.${moduleId}`;

const getProgressKey = (lessonId: string) =>
    `${PROGRESS_KEY_PREFIX}${lessonId}`;

export default function MindMapPane() {
    const { currentLessonId } = useLessonStore();
    const [code, setCode] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const svgContainerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Multi-Map state
    const [modules, setModules] = useState<ModuleInfo[]>([]);
    const [selectedModule, setSelectedModule] = useState<number>(-1); // -1 = all modules
    const [mapTitle, setMapTitle] = useState<string>("Mind Map");
    const [isFromCache, setIsFromCache] = useState(false);

    // Node detail panel state
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [nodeDetail, setNodeDetail] = useState<NodeDetail | null>(null);
    const [nodeLoading, setNodeLoading] = useState(false);
    const [activeAction, setActiveAction] = useState<'explain' | 'example' | 'quiz' | null>(null);

    // Quiz interaction state
    const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<string | null>(null);

    // PDF export
    const [pdfLoading, setPdfLoading] = useState(false);
    const handleExportPdf = async () => {
        if (!svgContainerRef.current) return;
        setPdfLoading(true);
        try {
            await exportToPdf(svgContainerRef.current, "MindMap", { orientation: "landscape" });
        } catch (err) {
            console.error("PDF export error:", err);
        } finally {
            setPdfLoading(false);
        }
    };
    const [showQuizResult, setShowQuizResult] = useState(false);

    // Progress tracking state
    const [learnedNodes, setLearnedNodes] = useState<LearnedNodes>({});
    const [allNodes, setAllNodes] = useState<string[]>([]);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '14px',
                primaryColor: '#6366f1',
                primaryTextColor: '#fff',
                primaryBorderColor: '#4f46e5',
                lineColor: '#94a3b8',
                secondaryColor: '#f1f5f9',
                tertiaryColor: '#e0f2fe'
            }
        });
    }, []);

    // Load modules list when lesson changes
    useEffect(() => {
        const loadModules = async () => {
            if (!currentLessonId) return;
            const res = await deepDiveApi.getModules(currentLessonId);
            if (res.ok && res.modules) {
                setModules(res.modules);
                setMapTitle(res.lessonTitle || "Zihin Haritası");
            }
        };
        loadModules();
        setSelectedModule(-1);
        setCode("");
        setIsFromCache(false);
    }, [currentLessonId]);

    // Load saved mindmap when module changes
    useEffect(() => {
        if (!currentLessonId) return;

        const storageKey = getStorageKey(currentLessonId, selectedModule);
        const saved = localStorage.getItem(storageKey);

        if (saved) {
            try {
                const parsed: SavedMindMap = JSON.parse(saved);
                if (parsed.code) {
                    setCode(parsed.code);
                    setMapTitle(parsed.title || "Zihin Haritası");
                    setIsFromCache(true);
                    setError(null);
                    return;
                }
            } catch (e) {
                console.error('Failed to parse saved mindmap:', e);
            }
        }

        // No saved map for this module
        setCode("");
        setIsFromCache(false);
    }, [currentLessonId, selectedModule]);

    // Save mindmap to localStorage
    const saveMindMap = useCallback((mapCode: string, title: string) => {
        if (!currentLessonId || !mapCode) return;

        const storageKey = getStorageKey(currentLessonId, selectedModule);
        const data: SavedMindMap = {
            code: mapCode,
            title: title,
            savedAt: Date.now()
        };
        localStorage.setItem(storageKey, JSON.stringify(data));
    }, [currentLessonId, selectedModule]);

    // Clear saved mindmap
    const clearSavedMap = useCallback(() => {
        if (!currentLessonId) return;

        const storageKey = getStorageKey(currentLessonId, selectedModule);
        localStorage.removeItem(storageKey);
        setCode("");
        setMapTitle("Zihin Haritası");
        setIsFromCache(false);
    }, [currentLessonId, selectedModule]);

    const generate = async () => {
        if (!currentLessonId) return;
        setLoading(true);
        setError(null);
        setCode("");
        setZoom(1);
        setIsFromCache(false);

        // Use module-specific API if a module is selected
        const res = selectedModule === -1
            ? await deepDiveApi.generateMindMap(currentLessonId)
            : await deepDiveApi.generateModuleMindMap(currentLessonId, selectedModule);

        setLoading(false);

        if (res.ok && res.code) {
            const newTitle = ('moduleTitle' in res && typeof res.moduleTitle === 'string')
                ? res.moduleTitle
                : mapTitle;

            setCode(res.code);
            setMapTitle(newTitle);

            // Save to localStorage
            saveMindMap(res.code, newTitle);
        } else {
            setError(res.error || "Failed to generate map.");
        }
    };

    // Load progress from localStorage
    useEffect(() => {
        if (!currentLessonId) return;
        const progressKey = getProgressKey(currentLessonId);
        const saved = localStorage.getItem(progressKey);
        if (saved) {
            try {
                setLearnedNodes(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse saved progress:', e);
            }
        }
    }, [currentLessonId]);

    // Save progress to localStorage
    useEffect(() => {
        if (!currentLessonId || Object.keys(learnedNodes).length === 0) return;
        const progressKey = getProgressKey(currentLessonId);
        localStorage.setItem(progressKey, JSON.stringify(learnedNodes));
    }, [learnedNodes, currentLessonId]);

    // Mermaid render with node click detection
    useEffect(() => {
        if (code && svgContainerRef.current) {
            svgContainerRef.current.innerHTML = "";
            const id = `mermaid-${Date.now()}`;
            try {
                mermaid.render(id, code)
                    .then(({ svg }) => {
                        if (svgContainerRef.current) {
                            svgContainerRef.current.innerHTML = svg;
                            const svgEl = svgContainerRef.current.querySelector('svg');
                            if (svgEl) {
                                svgEl.style.maxWidth = '100%';
                                svgEl.style.height = 'auto';
                                svgEl.style.minWidth = '800px';

                                // Extract all node names and add click handlers
                                const nodeElements = svgEl.querySelectorAll('.mindmap-node, .node, g[class*="node"]');
                                const extractedNodes: string[] = [];

                                nodeElements.forEach((node) => {
                                    const textEl = node.querySelector('text, foreignObject');
                                    let nodeName = textEl?.textContent?.trim() || '';

                                    // Clean up the node name
                                    nodeName = nodeName.replace(/^[📚❓🎯⚡💡📝🔗✅]\s*/, '').trim();

                                    if (nodeName && nodeName.length > 1) {
                                        extractedNodes.push(nodeName);

                                        // Store nodeName in data attribute for click handler
                                        (node as HTMLElement).setAttribute('data-node-name', nodeName);

                                        // Add click handler and styling
                                        (node as HTMLElement).style.cursor = 'pointer';

                                        // Find shape element inside node for hover effect
                                        const shape = node.querySelector('rect, circle, ellipse, polygon, path');
                                        const originalStroke = shape ? (shape as SVGElement).getAttribute('stroke') : null;
                                        const originalStrokeWidth = shape ? (shape as SVGElement).getAttribute('stroke-width') : null;

                                        node.addEventListener('mouseenter', () => {
                                            if (shape) {
                                                (shape as SVGElement).setAttribute('stroke', '#6366f1');
                                                (shape as SVGElement).setAttribute('stroke-width', '3');
                                            }
                                        });
                                        node.addEventListener('mouseleave', () => {
                                            if (shape) {
                                                if (originalStroke) {
                                                    (shape as SVGElement).setAttribute('stroke', originalStroke);
                                                } else {
                                                    (shape as SVGElement).removeAttribute('stroke');
                                                }
                                                if (originalStrokeWidth) {
                                                    (shape as SVGElement).setAttribute('stroke-width', originalStrokeWidth);
                                                } else {
                                                    (shape as SVGElement).removeAttribute('stroke-width');
                                                }
                                            }
                                        });
                                        node.addEventListener('click', (e) => {
                                            e.stopPropagation(); // Prevent event bubbling
                                            // Get nodeName from data attribute to avoid stale closure
                                            const clickedNodeName = (e.currentTarget as HTMLElement).getAttribute('data-node-name') || '';
                                            console.log('[MindMap] Node clicked:', clickedNodeName); // Debug log
                                            if (clickedNodeName) {
                                                setSelectedNode(clickedNodeName);
                                                setNodeDetail(null);
                                                setActiveAction(null);
                                                setSelectedQuizAnswer(null);
                                                setShowQuizResult(false);
                                            }
                                        });
                                    }
                                });

                                setAllNodes(extractedNodes);
                            }
                        }
                    })
                    .catch((e) => {
                        console.error("Mermaid Render Error:", e);
                        setError("Diagram render failed (syntax error).");
                    });
            } catch (e: any) {
                console.error(e);
                setError("Diagram render failed.");
            }
        }
    }, [code]);

    // Fetch node detail from AI - accepts nodeName parameter to avoid stale closure
    const fetchNodeDetail = useCallback(async (action: 'explain' | 'example' | 'quiz', nodeName?: string) => {
        const targetNode = nodeName || selectedNode;
        if (!currentLessonId || !targetNode) return;

        console.log('[MindMap] Fetching detail for:', targetNode, 'action:', action); // Debug log

        setNodeLoading(true);
        setActiveAction(action);
        setSelectedQuizAnswer(null);
        setShowQuizResult(false);

        const res = await deepDiveApi.getNodeDetail(currentLessonId, targetNode, action);

        setNodeLoading(false);

        if (res.ok) {
            setNodeDetail({
                title: res.title || targetNode,
                explanation: res.explanation,
                keyPoints: res.keyPoints,
                relatedConcepts: res.relatedConcepts,
                example: res.example,
                quiz: res.quiz
            });
        } else {
            setNodeDetail({ title: targetNode, explanation: res.error || 'Failed to get details' });
        }
    }, [currentLessonId, selectedNode]);

    // Toggle learned status
    const toggleLearned = useCallback((nodeName: string) => {
        setLearnedNodes(prev => ({
            ...prev,
            [nodeName]: !prev[nodeName]
        }));
    }, []);

    // Calculate progress
    const progressPercent = allNodes.length > 0
        ? Math.round((Object.values(learnedNodes).filter(Boolean).length / allNodes.length) * 100)
        : 0;

    // Zoom controls
    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
    const handleZoomReset = () => setZoom(1);

    // Fullscreen toggle
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Close detail panel
    const closeDetailPanel = () => {
        setSelectedNode(null);
        setNodeDetail(null);
        setActiveAction(null);
    };

    // Download as PNG
    const downloadAsPng = useCallback(async () => {
        const svgEl = svgContainerRef.current?.querySelector('svg');
        if (!svgEl) {
            alert('Önce haritayı oluşturun');
            return;
        }

        try {
            // Get SVG dimensions
            const bbox = svgEl.getBBox();
            const width = Math.max(bbox.width + bbox.x + 40, 800);
            const height = Math.max(bbox.height + bbox.y + 40, 600);

            // Clone SVG and set proper dimensions
            const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;
            clonedSvg.setAttribute('width', String(width));
            clonedSvg.setAttribute('height', String(height));
            clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

            // Add white background
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('width', '100%');
            bgRect.setAttribute('height', '100%');
            bgRect.setAttribute('fill', '#ffffff');
            clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

            const svgData = new XMLSerializer().serializeToString(clonedSvg);
            const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const scale = 2; // High DPI
                canvas.width = width * scale;
                canvas.height = height * scale;
                if (ctx) {
                    ctx.scale(scale, scale);
                    ctx.drawImage(img, 0, 0, width, height);
                }

                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `zihin-haritasi-${Date.now()}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }
                }, 'image/png');
            };

            img.onerror = () => {
                alert('PNG oluşturulurken hata oluştu');
            };

            img.src = svgBase64;
        } catch (e) {
            console.error('PNG download error:', e);
            alert('PNG indirme hatası');
        }
    }, []);

    // Download as SVG
    const downloadAsSvg = useCallback(() => {
        const svgEl = svgContainerRef.current?.querySelector('svg');
        if (!svgEl) return;

        const svgData = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zihin-haritasi-${Date.now()}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    if (!currentLessonId) return <div className="p-4 op-50">Ders seçilmedi.</div>;

    const containerStyles: React.CSSProperties = isFullscreen ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg, white)',
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
    } : {
        height: 'calc(100vh - 180px)',
        display: 'flex',
        flexDirection: 'column',
    };

    return (
        <div className="lc-section" style={containerStyles} ref={wrapperRef}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 12
            }}>
                <div>
                    <h3 className="fw-800 m-0" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        🗺️ {mapTitle || "Zihin Haritası"}
                        {isFullscreen && (
                            <span style={{
                                fontSize: 12,
                                background: '#6366f1',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: 4
                            }}>
                                Fullscreen
                            </span>
                        )}
                        {isFromCache && (
                            <span style={{
                                fontSize: 11,
                                background: 'var(--success, #22c55e)',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: 4
                            }}>
                                💾 Saved
                            </span>
                        )}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <p className="text-muted fs-12 m-0">Concept map for this lesson</p>
                        {code && (
                            <button
                                onClick={clearSavedMap}
                                title="Clear map"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    opacity: 0.6,
                                    color: 'var(--text)',
                                    transition: 'all 0.15s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--border)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent'; }}
                            >
                                🗑️ Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Module Selector + Controls */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Module Selector Dropdown */}
                    {modules.length > 0 && (
                        <select
                            value={selectedModule}
                            onChange={(e) => setSelectedModule(Number(e.target.value))}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                background: 'var(--input-bg)',
                                color: 'var(--text)',
                                fontSize: 13,
                                cursor: 'pointer',
                                minWidth: 180
                            }}
                        >
                            {modules.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.title}
                                </option>
                            ))}
                        </select>
                    )}
                    {code && (
                        <>
                            {/* Zoom Controls */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                background: 'var(--bg-secondary)',
                                borderRadius: 8,
                                padding: '4px 8px',
                                border: '1px solid var(--border)'
                            }}>
                                <button
                                    onClick={handleZoomOut}
                                    className="btn-icon"
                                    style={{ padding: 4, fontSize: 16 }}
                                    title="Zoom Out"
                                >
                                    ➖
                                </button>
                                <span style={{
                                    minWidth: 50,
                                    textAlign: 'center',
                                    fontSize: 12,
                                    fontWeight: 600
                                }}>
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    onClick={handleZoomIn}
                                    className="btn-icon"
                                    style={{ padding: 4, fontSize: 16 }}
                                    title="Zoom In"
                                >
                                    ➕
                                </button>
                                <button
                                    onClick={handleZoomReset}
                                    className="btn-icon"
                                    style={{ padding: 4, fontSize: 12 }}
                                    title="Reset Zoom"
                                >
                                    ↺
                                </button>
                            </div>

                            {/* Download Buttons */}
                            <div style={{
                                display: 'flex',
                                gap: 4,
                                background: 'var(--bg-secondary)',
                                borderRadius: 8,
                                padding: '4px 8px',
                                border: '1px solid var(--border)'
                            }}>
                                <button
                                    onClick={downloadAsPng}
                                    className="btn-icon"
                                    style={{ padding: '4px 8px', fontSize: 12 }}
                                    title="Download as PNG"
                                >
                                    📷 PNG
                                </button>
                                <button
                                    onClick={downloadAsSvg}
                                    className="btn-icon"
                                    style={{ padding: '4px 8px', fontSize: 12 }}
                                    title="Download as SVG"
                                >
                                    📐 SVG
                                </button>
                                <button
                                    onClick={handleExportPdf}
                                    className="btn-icon"
                                    style={{ padding: '4px 8px', fontSize: 12 }}
                                    disabled={pdfLoading}
                                    title="Download as PDF"
                                >
                                    {pdfLoading ? "..." : "PDF"}
                                </button>
                            </div>

                            {/* Fullscreen */}
                            <button
                                onClick={toggleFullscreen}
                                className="btn btn-ghost btn-sm"
                                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            >
                                {isFullscreen ? '⛶ Exit' : '⛶ Fullscreen'}
                            </button>
                        </>
                    )}

                    <button
                        className="btn btn-primary btn-sm"
                        onClick={generate}
                        disabled={loading}
                        style={{ minWidth: 140 }}
                    >
                        {loading ? '⏳ Generating...' : code ? '🔄 Regenerate' : '✨ Generate Map'}
                    </button>
                </div>
            </div>

            {/* Map Container */}
            <div
                ref={containerRef}
                className="mindmap-container"
                style={{
                    flex: 1,
                    overflow: 'auto',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: code ? 'flex-start' : 'center',
                    background: code ? '#fafbfc' : 'var(--bg-secondary)',
                    borderRadius: 16,
                    border: '1px solid var(--border)',
                    position: 'relative',
                    minHeight: 400,
                }}
            >
                {loading && (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                            style={{ fontSize: 60, marginBottom: 16, display: 'inline-block' }}
                        >
                            🧠
                        </motion.div>
                        <p className="text-muted fw-600" style={{ fontSize: 16 }}>
                            AI is connecting concepts...
                        </p>
                        <p className="text-muted fs-12">This may take 10-20 seconds</p>
                    </div>
                )}

                {!loading && !code && !error && (
                    <div className="text-center op-50" style={{ padding: 40 }}>
                        <div style={{ fontSize: 60, marginBottom: 16 }}>🗺️</div>
                        <p style={{ fontSize: 16, fontWeight: 600 }}>Click generate to see the map.</p>
                        <p className="text-muted fs-12">Visualize your lesson's key concepts</p>
                    </div>
                )}

                {error && (
                    <div className="text-red-500 fw-600 text-center" style={{ padding: 40 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                        <p>{error}</p>
                        <button className="btn btn-ghost mt-4" onClick={generate}>Try Again</button>
                    </div>
                )}

                {/* SVG Container with Zoom */}
                <div
                    ref={svgContainerRef}
                    style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top center',
                        transition: 'transform 0.2s ease',
                        padding: 40,
                        minWidth: 'fit-content'
                    }}
                />
            </div>

            {/* Progress Bar */}
            {code && allNodes.length > 0 && (
                <div style={{
                    marginTop: 12,
                    padding: '8px 16px',
                    background: 'var(--card)',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        📊 Progress
                    </span>
                    <div style={{
                        flex: 1,
                        height: 8,
                        background: 'var(--border)',
                        borderRadius: 4,
                        overflow: 'hidden'
                    }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.5 }}
                            style={{
                                height: '100%',
                                background: progressPercent === 100 ? '#22c55e' : 'var(--accent-2)',
                                borderRadius: 4
                            }}
                        />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: progressPercent === 100 ? '#22c55e' : 'var(--accent-2)' }}>
                        {progressPercent}%
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        ({Object.values(learnedNodes).filter(Boolean).length}/{allNodes.length} nodes)
                    </span>
                </div>
            )}

            {/* Hint */}
            {code && !isFullscreen && !selectedNode && (
                <div style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: 'var(--muted)',
                    textAlign: 'center'
                }}>
                    💡 Tip: Click on any node to see details and AI explanations
                </div>
            )}

            {/* Node Detail Side Panel */}
            <AnimatePresence>
                {selectedNode && (
                    <motion.div
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: 380,
                            maxWidth: '90vw',
                            background: 'var(--card)',
                            borderLeft: '1px solid var(--border)',
                            boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Panel Header */}
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            background: 'var(--bg)'
                        }}>
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: 'var(--accent-2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 18,
                                color: 'white'
                            }}>
                                🎯
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{selectedNode}</h3>
                                <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>Click buttons below for AI assistance</p>
                            </div>
                            <button
                                onClick={closeDetailPanel}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: 20,
                                    cursor: 'pointer',
                                    opacity: 0.6,
                                    padding: 4
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* AI Action Buttons */}
                        <div style={{
                            padding: '12px 16px',
                            display: 'flex',
                            gap: 8,
                            borderBottom: '1px solid var(--border)',
                            flexWrap: 'wrap'
                        }}>
                            <button
                                onClick={() => fetchNodeDetail('explain', selectedNode || undefined)}
                                disabled={nodeLoading}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: activeAction === 'explain' ? '2px solid var(--accent-2)' : '1px solid var(--border)',
                                    background: activeAction === 'explain' ? 'var(--accent-2)' : 'var(--bg)',
                                    color: activeAction === 'explain' ? 'white' : 'var(--text)',
                                    cursor: nodeLoading ? 'wait' : 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6
                                }}
                            >
                                📖 Explain
                            </button>
                            <button
                                onClick={() => fetchNodeDetail('example', selectedNode || undefined)}
                                disabled={nodeLoading}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: activeAction === 'example' ? '2px solid var(--accent-2)' : '1px solid var(--border)',
                                    background: activeAction === 'example' ? 'var(--accent-2)' : 'var(--bg)',
                                    color: activeAction === 'example' ? 'white' : 'var(--text)',
                                    cursor: nodeLoading ? 'wait' : 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6
                                }}
                            >
                                💡 Example
                            </button>
                            <button
                                onClick={() => fetchNodeDetail('quiz', selectedNode || undefined)}
                                disabled={nodeLoading}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: activeAction === 'quiz' ? '2px solid var(--accent-2)' : '1px solid var(--border)',
                                    background: activeAction === 'quiz' ? 'var(--accent-2)' : 'var(--bg)',
                                    color: activeAction === 'quiz' ? 'white' : 'var(--text)',
                                    cursor: nodeLoading ? 'wait' : 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6
                                }}
                            >
                                ❓ Quiz Me
                            </button>
                        </div>

                        {/* Content Area */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                            {nodeLoading && (
                                <div style={{ textAlign: 'center', padding: 40 }}>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                                        style={{ fontSize: 40, display: 'inline-block' }}
                                    >
                                        🤖
                                    </motion.div>
                                    <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
                                        AI is thinking...
                                    </p>
                                </div>
                            )}

                            {!nodeLoading && !nodeDetail && (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                                    <div style={{ fontSize: 50, marginBottom: 12 }}>👆</div>
                                    <p style={{ fontSize: 13 }}>Click a button above to get AI-powered insights</p>
                                </div>
                            )}

                            {!nodeLoading && nodeDetail && (
                                <div>
                                    {/* Explanation Content */}
                                    {nodeDetail.explanation && (
                                        <div style={{ marginBottom: 16 }}>
                                            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>
                                                {nodeDetail.explanation}
                                            </p>
                                            {nodeDetail.keyPoints && nodeDetail.keyPoints.length > 0 && (
                                                <div style={{ marginTop: 16 }}>
                                                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--accent-2)' }}>
                                                        🎯 Key Points
                                                    </h4>
                                                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                                                        {nodeDetail.keyPoints.map((point, i) => (
                                                            <li key={i} style={{ fontSize: 13, marginBottom: 6, color: 'var(--text)' }}>
                                                                {point}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Example Content */}
                                    {nodeDetail.example && (
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{
                                                background: 'var(--bg)',
                                                borderRadius: 12,
                                                padding: 16,
                                                border: '1px solid var(--border)'
                                            }}>
                                                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--accent-2)' }}>
                                                    📌 Scenario
                                                </h4>
                                                <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                                                    {nodeDetail.example.scenario}
                                                </p>
                                                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--accent-2)' }}>
                                                    💡 How it applies
                                                </h4>
                                                <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                                                    {nodeDetail.example.explanation}
                                                </p>
                                                <div style={{
                                                    background: 'var(--accent-2)',
                                                    color: 'white',
                                                    padding: '10px 14px',
                                                    borderRadius: 8,
                                                    fontSize: 12,
                                                    fontWeight: 600
                                                }}>
                                                    ✨ Takeaway: {nodeDetail.example.takeaway}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Quiz Content */}
                                    {nodeDetail.quiz && (
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{
                                                background: 'var(--bg)',
                                                borderRadius: 12,
                                                padding: 16,
                                                border: '1px solid var(--border)'
                                            }}>
                                                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                                                    {nodeDetail.quiz.question}
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {nodeDetail.quiz.options.map((option, i) => {
                                                        const optionLetter = option.charAt(0);
                                                        const isSelected = selectedQuizAnswer === optionLetter;
                                                        const isCorrect = optionLetter === nodeDetail.quiz!.correctAnswer;
                                                        const showResult = showQuizResult;

                                                        return (
                                                            <button
                                                                key={i}
                                                                onClick={() => {
                                                                    if (!showQuizResult) {
                                                                        setSelectedQuizAnswer(optionLetter);
                                                                        setShowQuizResult(true);
                                                                    }
                                                                }}
                                                                disabled={showQuizResult}
                                                                style={{
                                                                    padding: '12px 14px',
                                                                    borderRadius: 8,
                                                                    border: showResult
                                                                        ? isCorrect
                                                                            ? '2px solid #22c55e'
                                                                            : isSelected
                                                                                ? '2px solid #ef4444'
                                                                                : '1px solid var(--border)'
                                                                        : isSelected
                                                                            ? '2px solid var(--accent-2)'
                                                                            : '1px solid var(--border)',
                                                                    background: showResult
                                                                        ? isCorrect
                                                                            ? 'rgba(34, 197, 94, 0.1)'
                                                                            : isSelected
                                                                                ? 'rgba(239, 68, 68, 0.1)'
                                                                                : 'var(--card)'
                                                                        : 'var(--card)',
                                                                    cursor: showQuizResult ? 'default' : 'pointer',
                                                                    textAlign: 'left',
                                                                    fontSize: 13,
                                                                    color: 'var(--text)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 8
                                                                }}
                                                            >
                                                                {showResult && isCorrect && <span>✅</span>}
                                                                {showResult && isSelected && !isCorrect && <span>❌</span>}
                                                                {option}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {showQuizResult && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        style={{
                                                            marginTop: 16,
                                                            padding: 12,
                                                            borderRadius: 8,
                                                            background: selectedQuizAnswer === nodeDetail.quiz!.correctAnswer
                                                                ? 'rgba(34, 197, 94, 0.1)'
                                                                : 'rgba(239, 68, 68, 0.1)',
                                                            border: `1px solid ${selectedQuizAnswer === nodeDetail.quiz!.correctAnswer ? '#22c55e' : '#ef4444'}`
                                                        }}
                                                    >
                                                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                                                            {selectedQuizAnswer === nodeDetail.quiz!.correctAnswer
                                                                ? '🎉 Correct!'
                                                                : '💡 Not quite right'}
                                                        </p>
                                                        <p style={{ fontSize: 12, color: 'var(--text)', opacity: 0.8 }}>
                                                            {nodeDetail.quiz!.explanation}
                                                        </p>
                                                    </motion.div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer with Learned Checkbox */}
                        <div style={{
                            padding: '12px 16px',
                            borderTop: '1px solid var(--border)',
                            background: 'var(--bg)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10
                        }}>
                            <label style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 600
                            }}>
                                <input
                                    type="checkbox"
                                    checked={learnedNodes[selectedNode] || false}
                                    onChange={() => toggleLearned(selectedNode)}
                                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                                />
                                <span style={{ color: learnedNodes[selectedNode] ? '#22c55e' : 'var(--text)' }}>
                                    {learnedNodes[selectedNode] ? '✅ Learned!' : 'Mark as learned'}
                                </span>
                            </label>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Backdrop for panel */}
            <AnimatePresence>
                {selectedNode && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeDetailPanel}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.3)',
                            zIndex: 999
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
