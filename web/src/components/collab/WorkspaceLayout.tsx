import React, { lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";
import ToolSidebar from "./ToolSidebar";
import CompactChat from "./CompactChat";

const SharedDeepDive = lazy(() => import("./SharedDeepDive"));
const SharedFlashcardBuilder = lazy(() => import("./SharedFlashcardBuilder"));
const SharedMindMap = lazy(() => import("./SharedMindMap"));
const SharedNotes = lazy(() => import("./SharedNotes"));
const SharedQuiz = lazy(() => import("./SharedQuiz"));
const SharedSprint = lazy(() => import("./SharedSprint"));

export default function WorkspaceLayout() {
  const activeTool = useRoomStore((s) => s.activeTool);
  const chatOpen = useRoomStore((s) => s.chatOpen);
  const setChatOpen = useRoomStore((s) => s.setChatOpen);

  return (
    <div className="ws-body">
      <ToolSidebar />
      <div className="ws-content">
        <div className="ws-content__main">
          <Suspense fallback={<div className="pane-empty"><div className="pane-empty__desc">Loading...</div></div>}>
            {activeTool === "deep-dive" && <SharedDeepDive />}
            {activeTool === "flashcards" && <SharedFlashcardBuilder />}
            {activeTool === "mind-map" && <SharedMindMap />}
            {activeTool === "notes" && <SharedNotes />}
            {activeTool === "quiz" && <SharedQuiz />}
            {activeTool === "sprint" && <SharedSprint />}
          </Suspense>
        </div>
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden", flexShrink: 0 }}
            >
              <CompactChat onClose={() => setChatOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
