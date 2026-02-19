import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Channel, LessonContextInfo } from "../../../types";
import { useChannelToolStore } from "../../../stores/channelToolStore";
import { useServerStore } from "../../../stores/serverStore";
import { channelToolApi } from "../../../services/channelToolApi";
import { getCollabSocket } from "../../../services/collabSocket";
import ChannelNotes from "./ChannelNotes";
import ChannelDeepDive from "./ChannelDeepDive";
import ChannelQuiz from "./ChannelQuiz";
import ChannelFlashcards from "./ChannelFlashcards";
import ChannelMindMap from "./ChannelMindMap";
import ChannelSprint from "./ChannelSprint";
import MaterialLinker from "./MaterialLinker";
import LessonDataPanel from "./LessonDataPanel";

interface Props {
  channel: Channel;
  serverId: string;
  serverName: string;
  userId: string;
  nickname: string;
}

const TOOL_ICONS: Record<string, string> = {
  "deep-dive": "\uD83D\uDD2C",
  flashcards: "\uD83C\uDCCF",
  "mind-map": "\uD83E\uDDE0",
  notes: "\uD83D\uDCDD",
  quiz: "\u2753",
  sprint: "\u23F1\uFE0F",
};

const TOOL_LABELS: Record<string, string> = {
  "deep-dive": "Deep Dive",
  flashcards: "Flashcards",
  "mind-map": "Mind Map",
  notes: "Notlar",
  quiz: "Quiz",
  sprint: "Sprint",
};

export default function ChannelToolRouter({ channel, serverId, serverName, userId, nickname }: Props) {
  const loadToolData = useChannelToolStore((s) => s.loadToolData);
  const loading = useChannelToolStore((s) => s.loading[channel.id]);
  const updateChannelLesson = useServerStore((s) => s.updateChannelLesson);
  const [linkerOpen, setLinkerOpen] = useState(false);
  const [lessonCtx, setLessonCtx] = useState<LessonContextInfo | null>(null);
  const [showLessonPanel, setShowLessonPanel] = useState(false);

  useEffect(() => {
    loadToolData(channel.id);
    setShowLessonPanel(false);
  }, [channel.id]);

  // Fetch lesson context info for badges
  useEffect(() => {
    if (channel.lessonId) {
      channelToolApi.getLessonContext(channel.id).then(setLessonCtx).catch(() => setLessonCtx(null));
    } else {
      setLessonCtx(null);
    }
  }, [channel.id, channel.lessonId]);

  const handleLink = async (lessonId: string, lessonTitle: string) => {
    try {
      await channelToolApi.linkLesson(channel.id, serverId, userId, lessonId, lessonTitle);
      updateChannelLesson(channel.id, lessonId, lessonTitle);
      const socket = getCollabSocket();
      socket.emit("channel:lesson:linked", { channelId: channel.id, lessonId, lessonTitle });
      channelToolApi.getLessonContext(channel.id).then(setLessonCtx).catch(() => {});
    } catch (err) {
      console.error("Failed to link lesson:", err);
    }
  };

  const handleUnlink = async () => {
    try {
      await channelToolApi.unlinkLesson(channel.id, serverId, userId);
      updateChannelLesson(channel.id, undefined, undefined);
      setLessonCtx(null);
      setShowLessonPanel(false);
      const socket = getCollabSocket();
      socket.emit("channel:lesson:unlinked", { channelId: channel.id });
    } catch (err) {
      console.error("Failed to unlink lesson:", err);
    }
  };

  const topic = channel.lessonTitle || channel.name;
  const icon = TOOL_ICONS[channel.toolType || ""] || "\uD83D\uDD27";
  const toolLabel = TOOL_LABELS[channel.toolType || ""] || channel.toolType || "";

  const commonProps = {
    channelId: channel.id,
    topic,
    serverName,
    userId,
    nickname,
    lessonContext: lessonCtx,
  };

  if (loading) {
    return (
      <div className="sh-tool">
        <div className="sh-tool__header sh-tool__header--gradient">
          <div className="sh-tool__header-left">
            <span className="sh-tool__header-icon">{icon}</span>
            <div>
              <h3 className="sh-main-content__channel-name">{channel.name}</h3>
              <span className="sh-tool__subtitle">{toolLabel}</span>
            </div>
          </div>
        </div>
        <div className="sh-tool__body">
          <div className="sh-tool__loading">
            <div className="sh-skeleton sh-skeleton--line" />
            <div className="sh-skeleton sh-skeleton--line sh-skeleton--short" />
            <div className="sh-skeleton sh-skeleton--line" />
            <div className="sh-skeleton sh-skeleton--card" />
          </div>
        </div>
      </div>
    );
  }

  function renderTool() {
    switch (channel.toolType) {
      case "notes":
        return <ChannelNotes channelId={commonProps.channelId} topic={commonProps.topic} serverName={serverName} userId={userId} nickname={nickname} />;
      case "deep-dive":
        return <ChannelDeepDive {...commonProps} />;
      case "quiz":
        return <ChannelQuiz {...commonProps} />;
      case "flashcards":
        return <ChannelFlashcards {...commonProps} />;
      case "mind-map":
        return <ChannelMindMap {...commonProps} />;
      case "sprint":
        return <ChannelSprint channelId={commonProps.channelId} topic={commonProps.topic} serverName={serverName} userId={userId} nickname={nickname} />;
      default:
        return (
          <div className="sh-tool">
            <div className="sh-tool__empty">
              <div className="sh-tool__empty-icon">{"\uD83D\uDD27"}</div>
              <h3 className="sh-tool__empty-title">Bilinmeyen Ara{"\u00E7"} T{"\u00FC"}r{"\u00FC"}</h3>
              <p className="sh-tool__empty-desc">
                Bu kanal t{"\u00FC"}r{"\u00FC"} hen{"\u00FC"}z desteklenmiyor: <strong>{channel.toolType}</strong>
              </p>
            </div>
          </div>
        );
    }
  }

  // Build badges from lesson context
  const badges: { label: string; active: boolean }[] = [];
  if (lessonCtx?.linked) {
    badges.push({ label: "Transcript", active: !!lessonCtx.hasTranscript });
    badges.push({ label: "Slides", active: !!lessonCtx.hasSlides });
    badges.push({
      label: lessonCtx.emphasesCount ? `${lessonCtx.emphasesCount} Emphases` : "Emphases",
      active: (lessonCtx.emphasesCount || 0) > 0,
    });
    badges.push({ label: "Cheat Sheet", active: !!lessonCtx.hasCheatSheet });
    badges.push({
      label: lessonCtx.loModuleCount ? `${lessonCtx.loModuleCount} LO Modules` : "LO Modules",
      active: !!lessonCtx.hasLoModules,
    });
    badges.push({ label: "LOs", active: !!lessonCtx.hasLearningOutcomes });
  }

  return (
    <>
      {/* Material Bar */}
      <div className="sh-material-bar">
        <div className="sh-material-bar__content">
          <div className="sh-material-bar__top">
            {channel.lessonId ? (
              <>
                <span className="sh-material-bar__linked">{"\uD83D\uDCDA"} {channel.lessonTitle}</span>
                <button
                  className={`sh-material-bar__btn${showLessonPanel ? " sh-material-bar__btn--active" : ""}`}
                  onClick={() => setShowLessonPanel((s) => !s)}
                >
                  {showLessonPanel ? "Paneli Kapat" : "Ders Icerigi"}
                </button>
                <button className="sh-material-bar__btn" onClick={() => setLinkerOpen(true)}>Degistir</button>
              </>
            ) : (
              <>
                <span className="sh-material-bar__empty">Materyal bagli degil</span>
                <button className="sh-material-bar__btn sh-material-bar__btn--primary" onClick={() => setLinkerOpen(true)}>Materyal Bagla</button>
              </>
            )}
          </div>
          {badges.length > 0 && (
            <div className="sh-material-bar__badges">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className={`sh-material-bar__badge${b.active ? " sh-material-bar__badge--active" : ""}`}
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <LessonDataPanel channelId={channel.id} open={showLessonPanel} />

      <AnimatePresence mode="wait">
        <motion.div
          key={channel.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ type: "tween", duration: 0.2 }}
        >
          {renderTool()}
        </motion.div>
      </AnimatePresence>

      <MaterialLinker
        open={linkerOpen}
        onClose={() => setLinkerOpen(false)}
        onLink={handleLink}
        onUnlink={handleUnlink}
        currentLessonId={channel.lessonId}
      />
    </>
  );
}
