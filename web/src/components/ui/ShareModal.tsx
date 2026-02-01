import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useShareStore } from "../../stores/shareStore";

export default function ShareModal({
  shareId,
  onClose,
  onImport,
}: {
  shareId: string;
  onClose: () => void;
  onImport: (lessonId: string) => void;
}) {
  const { currentShare, fetchShare, importShare, loading, error } = useShareStore();
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchShare(shareId);
  }, [shareId]);

  const handleImport = async () => {
    setImporting(true);
    const lessonId = await importShare(shareId);
    if (lessonId) {
      onImport(lessonId);
    }
    setImporting(false);
  };

  // Loading state
  if (loading && !currentShare) {
    return (
      <motion.div
        className="modal-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="modal"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          style={{ maxWidth: 500, width: "90%" }}
        >
          <div className="pane-empty" style={{ padding: 32 }}>
            <div className="pane-empty__desc">Loading shared content...</div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Error state
  if (error || !currentShare) {
    return (
      <motion.div
        className="modal-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="modal"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          style={{ maxWidth: 500, width: "90%" }}
        >
          <div className="pane-empty">
            <div className="pane-empty__icon">!</div>
            <div className="pane-empty__title">Share not found</div>
            <div className="pane-empty__desc">
              {error || "This link may have expired."}
            </div>
            <button className="btn" onClick={onClose} style={{ marginTop: 16 }}>
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  const bundle = currentShare.bundle;

  return (
    <motion.div
      className="modal-backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ maxWidth: 500, width: "90%", textAlign: "left" }}
      >
        <div className="share-modal-content">
          <div className="share-modal-title">{bundle.title}</div>

          <div className="share-modal-meta">
            <span>By {currentShare.createdBy}</span>
            <span>Views: {currentShare.accessCount}</span>
            <span>Expires: {new Date(currentShare.expiresAt).toLocaleDateString()}</span>
          </div>

          {/* Bundle preview grid */}
          <div className="share-bundle-grid">
            <div className="share-bundle-item">
              <div className="share-bundle-item__label">Plan</div>
              <div className="share-bundle-item__value">
                {bundle.plan ? "Yes" : "No"}
              </div>
            </div>
            <div className="share-bundle-item">
              <div className="share-bundle-item__label">Cheat Sheet</div>
              <div className="share-bundle-item__value">
                {bundle.cheatSheet ? "Yes" : "No"}
              </div>
            </div>
            <div className="share-bundle-item">
              <div className="share-bundle-item__label">Emphases</div>
              <div className="share-bundle-item__value">{bundle.emphases.length}</div>
            </div>
            <div className="share-bundle-item">
              <div className="share-bundle-item__label">LO Modules</div>
              <div className="share-bundle-item__value">
                {bundle.loModules ? bundle.loModules.length : 0}
              </div>
            </div>
          </div>

          {/* Key emphases */}
          {bundle.emphases.length > 0 && (
            <div className="share-emphases">
              <div className="share-emphases__title">Key Emphases</div>
              <ul>
                {bundle.emphases.slice(0, 3).map((e: any, i: number) => (
                  <li key={i}>{e.statement || e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Comments */}
          {currentShare.comments.length > 0 && (
            <div className="share-comments">
              <div className="wk-section-title" style={{ marginBottom: 8 }}>Comments</div>
              {currentShare.comments.map((c, i) => (
                <div key={i} className="share-comment">
                  <span className="share-comment__author">{c.author}:</span>
                  {c.text}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="share-modal-footer">
            <button className="btn-small" onClick={onClose}>
              Close
            </button>
            <button className="btn" onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : "Import to My Lessons"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
