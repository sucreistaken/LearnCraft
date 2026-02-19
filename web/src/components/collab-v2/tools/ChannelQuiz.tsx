import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChannelToolStore } from "../../../stores/channelToolStore";
import { channelToolApi } from "../../../services/channelToolApi";
import { getCollabSocket } from "../../../services/collabSocket";
import type { ChannelQuizQuestion, LessonContextInfo } from "../../../types";

interface Props {
  channelId: string;
  topic: string;
  serverName: string;
  userId: string;
  nickname: string;
  lessonContext?: LessonContextInfo | null;
}

const EMPTY_Q: ChannelQuizQuestion[] = [];
const EMPTY_SCORES: Record<string, { correct: number; total: number; nickname: string }> = {};
const LETTERS = ["A", "B", "C", "D"];
const COUNT_OPTIONS = [5, 10, 15, 20];

export default function ChannelQuiz({ channelId, topic, serverName, userId, nickname, lessonContext }: Props) {
  const questions = useChannelToolStore(s => s.dataByChannel[channelId]?.quiz?.questions ?? EMPTY_Q);
  const scores = useChannelToolStore(s => s.dataByChannel[channelId]?.quiz?.scores ?? EMPTY_SCORES);
  const loadToolData = useChannelToolStore(s => s.loadToolData);
  const updateQuiz = useChannelToolStore(s => s.updateQuiz);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; correctIndex: number; explanation: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [sourcesSummary, setSourcesSummary] = useState<string | null>(null);

  // Quiz config
  const [quizCount, setQuizCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [includeTF, setIncludeTF] = useState(true);

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await channelToolApi.generateQuiz(channelId, topic, serverName, quizCount, difficulty, includeTF);
      setSourcesSummary(res.sourcesSummary || null);
      await loadToolData(channelId);
      setCurrentIndex(0);
      setSelectedIndex(null);
      setAnswered(false);
      setResult(null);
      setShowResults(false);
    } catch (err) {
      console.error("Failed to generate quiz:", err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSelectOption(optIndex: number) {
    if (answered || selectedIndex !== null) return;
    const question = questions[currentIndex];
    if (!question) return;
    setSelectedIndex(optIndex);

    try {
      const { result: answerResult } = await channelToolApi.answerQuiz(
        channelId, userId, nickname, question.id, optIndex
      );
      setResult({
        correct: answerResult.correct,
        correctIndex: answerResult.correctIndex,
        explanation: answerResult.explanation,
      });
      setAnswered(true);

      if (answerResult.scores) {
        const existingQuiz = useChannelToolStore.getState().dataByChannel[channelId]?.quiz;
        if (existingQuiz) {
          updateQuiz(channelId, { ...existingQuiz, scores: answerResult.scores });
        }
      }

      getCollabSocket().emit("tool:quiz:answer", {
        channelId,
        result: { userId, nickname, questionId: question.id, correct: answerResult.correct, scores: answerResult.scores },
      });
    } catch (err) {
      console.error("Failed to submit answer:", err);
      setSelectedIndex(null);
    }
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedIndex(null);
      setAnswered(false);
      setResult(null);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedIndex(null);
      setAnswered(false);
      setResult(null);
    } else {
      setShowResults(true);
    }
  }

  function getOptionClass(optIndex: number): string {
    let cls = "sh-quiz__option";
    if (!answered) return cls;
    if (optIndex === selectedIndex) cls += " sh-quiz__option--selected";
    if (optIndex === result?.correctIndex) cls += " sh-quiz__option--correct";
    else if (optIndex === selectedIndex && !result?.correct) cls += " sh-quiz__option--wrong";
    return cls;
  }

  const scoreEntries = Object.entries(scores).sort(
    ([, a], [, b]) => b.correct - a.correct || a.total - b.total
  );
  const myScore = scores[userId];

  // Empty state
  if (questions.length === 0 && !showResults) {
    return (
      <div className="sh-tool">
        <div className="sh-tool__header sh-quiz__header-gradient">
          <div className="sh-tool__header-left">
            <div className="sh-quiz__header-icon">
              <span className="sh-quiz__header-icon-inner">?</span>
            </div>
            <h3 className="sh-main-content__channel-name">Quiz - {topic}</h3>
          </div>
        </div>
        <div className="sh-tool__body">
          <div className="sh-tool__empty sh-quiz__empty-state">
            <div className="sh-quiz__empty-icon-wrapper">
              <svg className="sh-quiz__empty-icon" viewBox="0 0 48 48" width="64" height="64" fill="none">
                <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                <text x="24" y="32" textAnchor="middle" fontSize="26" fill="currentColor" fontWeight="bold">?</text>
              </svg>
            </div>
            <h3 className="sh-tool__empty-title">Create a Quiz</h3>
            <p className="sh-tool__empty-desc">Test your knowledge with AI-generated questions about "{topic}"</p>

            <div className="sh-quiz__config sh-quiz__config-card">
              <div className="sh-quiz__config-card-header">
                <span className="sh-quiz__config-card-title">Quiz Settings</span>
              </div>

              <div className="sh-quiz__config-grid">
                <div className="sh-quiz__config-row">
                  <label className="sh-quiz__config-label">Questions</label>
                  <div className="sh-quiz__config-options">
                    {COUNT_OPTIONS.map((c) => (
                      <button
                        key={c}
                        className={`sh-quiz__config-btn ${quizCount === c ? "sh-quiz__config-btn--active" : ""}`}
                        onClick={() => setQuizCount(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sh-quiz__config-row">
                  <label className="sh-quiz__config-label">Difficulty</label>
                  <div className="sh-quiz__config-options">
                    {(["easy", "medium", "hard"] as const).map((d) => (
                      <button
                        key={d}
                        className={`sh-quiz__config-btn ${difficulty === d ? "sh-quiz__config-btn--active" : ""}`}
                        onClick={() => setDifficulty(d)}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sh-quiz__config-row sh-quiz__config-row--checkbox">
                  <label className="sh-quiz__config-checkbox-label">
                    <input
                      type="checkbox"
                      checked={includeTF}
                      onChange={(e) => setIncludeTF(e.target.checked)}
                      className="sh-quiz__config-checkbox"
                    />{" "}
                    Include True/False questions
                  </label>
                </div>
              </div>

              <div className="sh-quiz__config-actions">
                <button
                  className="lc-btn lc-btn--primary lc-btn--sm sh-quiz__generate-btn"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <span className="sh-quiz__spinner" />
                      Generating...
                    </>
                  ) : (
                    "Generate Quiz"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results view
  if (showResults) {
    return (
      <div className="sh-tool">
        <div className="sh-tool__header sh-quiz__header-gradient">
          <div className="sh-tool__header-left">
            <div className="sh-quiz__header-icon">
              <span className="sh-quiz__header-icon-inner">&#9733;</span>
            </div>
            <h3 className="sh-main-content__channel-name">Quiz Results - {topic}</h3>
          </div>
        </div>
        <div className="sh-tool__body">
          <div className="sh-quiz__scoreboard">
            {myScore && (
              <div className="sh-quiz__my-score sh-quiz__my-score-card">
                <div className="sh-quiz__my-score-top">
                  <span className="sh-quiz__my-score-label">Your Score</span>
                </div>
                <div className="sh-quiz__my-score-main">
                  <span className="sh-quiz__my-score-value">{myScore.correct}/{myScore.total}</span>
                  <span className="sh-quiz__my-score-pct">
                    {myScore.total > 0 ? Math.round((myScore.correct / myScore.total) * 100) : 0}%
                  </span>
                </div>
                <div className="sh-quiz__my-score-bar-track">
                  <div
                    className="sh-quiz__my-score-bar-fill"
                    style={{ width: `${myScore.total > 0 ? (myScore.correct / myScore.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <h4 className="sh-quiz__scoreboard-title">Scoreboard</h4>
            {scoreEntries.length === 0 ? (
              <p className="sh-quiz__scoreboard-empty">No scores yet.</p>
            ) : (
              <div className="sh-quiz__score-grid">
                {scoreEntries.map(([id, score], idx) => {
                  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
                  return (
                    <div key={id} className={`sh-quiz__score-card${id === userId ? " sh-quiz__score-card--me" : ""}`}>
                      <div className="sh-quiz__score-card-top">
                        <span className="sh-quiz__score-rank">#{idx + 1}</span>
                        <div className="sh-quiz__score-avatar">
                          {score.nickname.charAt(0).toUpperCase()}
                        </div>
                        <span className="sh-quiz__score-name">{score.nickname}</span>
                        <span className="sh-quiz__score-value">{score.correct}/{score.total}</span>
                      </div>
                      <div className="sh-quiz__score-bar-track">
                        <div className="sh-quiz__score-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="sh-quiz__results-actions">
              <button className="lc-btn lc-btn--primary lc-btn--sm" onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <span className="sh-quiz__spinner" />
                    Generating...
                  </>
                ) : (
                  "New Quiz"
                )}
              </button>
              <button className="lc-btn lc-btn--ghost lc-btn--sm" onClick={() => { setShowResults(false); setCurrentIndex(0); setSelectedIndex(null); setAnswered(false); setResult(null); }}>
                Review Questions
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Question view
  const currentQuestion = questions[currentIndex];
  const qType = (currentQuestion as any)?.type === 'tf' ? 'T/F' : 'MC';

  return (
    <div className="sh-tool">
      <div className="sh-tool__header sh-quiz__header-gradient">
        <div className="sh-tool__header-left">
          <div className="sh-quiz__header-icon">
            <span className="sh-quiz__header-icon-inner">?</span>
          </div>
          <h3 className="sh-main-content__channel-name">Quiz - {topic}</h3>
          <span className="sh-tool__count">{currentIndex + 1}/{questions.length}</span>
          {myScore && (
            <span className="sh-quiz__inline-score">
              <span className="sh-quiz__inline-score-icon">&#10003;</span>
              {myScore.correct}/{myScore.total}
            </span>
          )}
        </div>
        <div className="sh-tool__header-right">
          <button className="lc-btn lc-btn--ghost lc-btn--sm" onClick={() => setShowResults(true)}>
            Scoreboard
          </button>
        </div>
      </div>

      <div className="sh-tool__body">
        <div className="sh-quiz__progress">
          <div className="sh-quiz__progress-bar">
            <div className="sh-quiz__progress-fill" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        {sourcesSummary && (
          <div className="sh-tool__context-info">
            Kaynak: {sourcesSummary} temelinde olu{"\u015F"}turuldu
          </div>
        )}

        <AnimatePresence mode="wait">
          {currentQuestion && (
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              <div className="sh-quiz__question sh-quiz__question-card">
                <div className="sh-quiz__question-card-accent" />
                <div className="sh-quiz__question-meta">
                  <span className="sh-quiz__question-number sh-quiz__question-number-badge">
                    {currentIndex + 1}
                  </span>
                  <span className="sh-quiz__question-type sh-quiz__question-type-badge">{qType}</span>
                </div>
                <p className="sh-quiz__question-text">{currentQuestion.question}</p>
              </div>

              <div className="sh-quiz__options">
                {currentQuestion.options.map((option, optIdx) => (
                  <button key={optIdx} className={getOptionClass(optIdx)} onClick={() => handleSelectOption(optIdx)} disabled={answered}>
                    <span className="sh-quiz__option-letter sh-quiz__option-letter-badge">
                      {qType === 'T/F' ? '' : LETTERS[optIdx] ?? String(optIdx + 1)}
                    </span>
                    <span className="sh-quiz__option-text">{option}</span>
                    {answered && optIdx === result?.correctIndex && (
                      <span className="sh-quiz__option-result-icon sh-quiz__option-result-icon--correct">&#10003;</span>
                    )}
                    {answered && optIdx === selectedIndex && !result?.correct && optIdx !== result?.correctIndex && (
                      <span className="sh-quiz__option-result-icon sh-quiz__option-result-icon--wrong">&#10007;</span>
                    )}
                  </button>
                ))}
              </div>

              {answered && result && (
                <motion.div
                  className={`sh-quiz__explanation ${result.correct ? "sh-quiz__explanation--correct" : "sh-quiz__explanation--wrong"}`}
                  initial={{ scale: 0.9, y: 10, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <div className="sh-quiz__explanation-header">
                    <span className="sh-quiz__explanation-icon">
                      {result.correct ? "\u2713" : "\u2717"}
                    </span>
                    <strong>{result.correct ? "Correct!" : "Wrong"}</strong>
                  </div>
                  <p className="sh-quiz__explanation-text">{result.explanation}</p>
                </motion.div>
              )}

              <div className="sh-quiz__nav">
                <button className="lc-btn lc-btn--ghost lc-btn--sm" onClick={handlePrevious} disabled={currentIndex === 0}>
                  Previous
                </button>

                <div className="sh-quiz__dot-indicators">
                  {questions.map((_, dotIdx) => (
                    <span
                      key={dotIdx}
                      className={`sh-quiz__dot${dotIdx === currentIndex ? " sh-quiz__dot--active" : ""}${dotIdx < currentIndex ? " sh-quiz__dot--done" : ""}`}
                    />
                  ))}
                </div>

                <button className="lc-btn lc-btn--primary lc-btn--sm" onClick={handleNext} disabled={!answered}>
                  {currentIndex < questions.length - 1 ? "Next" : "Results"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
