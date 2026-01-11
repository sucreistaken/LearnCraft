// src/hooks/useTranscription.ts
import { useCallback, useRef } from 'react';
import { useLessonStore } from '../stores/lessonStore';
import { useUiStore } from '../stores/uiStore';
import { uploadApi } from '../services/api';

// Time formatting helpers
function fmtTime(sec: number): string {
    const s = Math.max(0, sec || 0);
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${mm}:${String(ss).padStart(2, '0')}`;
}

function formatTime(sec: number): string {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;

    const mm = String(m).padStart(2, '0');
    const ss = String(r).padStart(2, '0');

    if (h > 0) return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
    return `${mm}:${ss}`;
}

export function useTranscription() {
    const store = useLessonStore();
    const ui = useUiStore();
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    const showToast = useCallback((txt: string) => {
        ui.setSttProgress({ toast: txt });
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = setTimeout(() => {
            ui.setSttProgress({ toast: null });
        }, 1200);
    }, [ui]);

    const startTranscription = useCallback(async (file: File) => {
        const { currentLessonId } = store;

        if (!currentLessonId) {
            store.setError('First create or select a lesson (lessonId needed).');
            return;
        }

        store.setError(null);
        ui.setSttProgress({
            progress: 0,
            now: null,
            status: 'Loading...',
            toast: null,
        });

        try {
            const result = await uploadApi.startTranscribe(file, currentLessonId);

            if (!result.ok) {
                store.setError(result.error || 'Start transcribe error');
                ui.setSttProgress({ status: 'Failed to start ❌' });
                return;
            }

            // Clear transcript for new transcription
            store.setLectureText('');
            ui.setSttProgress({ status: 'Transcribing...' });

            // Start SSE connection
            const streamUrl = uploadApi.getTranscribeStreamUrl(result.jobId);
            const es = new EventSource(streamUrl);
            eventSourceRef.current = es;

            es.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data);

                    if (msg.type === 'meta') {
                        ui.setSttProgress({
                            status: `Model: ${msg.model} • Duration: ${(msg.duration / 60).toFixed(1)} min`,
                        });
                        return;
                    }

                    if (msg.type === 'log') {
                        if (typeof msg.message === 'string' && msg.message.trim()) {
                            ui.setSttProgress({
                                status: `Preparing... (${msg.message.trim().slice(0, 60)})`,
                            });
                        }
                        return;
                    }

                    if (msg.type === 'segment') {
                        const p = Math.round((msg.progress ?? 0) * 100);

                        if (typeof msg.start === 'number' && typeof msg.end === 'number') {
                            ui.setSttProgress({
                                progress: p,
                                now: { start: msg.start, end: msg.end },
                                status: `Transcribing ${fmtTime(msg.start)}–${fmtTime(msg.end)} (${p}%)`,
                            });
                            showToast(`${fmtTime(msg.start)}–${fmtTime(msg.end)}`);
                        }

                        if (msg.text) {
                            const line = `[${formatTime(msg.start)} – ${formatTime(msg.end)}] ${msg.text}`;
                            const currentText = useLessonStore.getState().lectureText;
                            store.setLectureText(
                                currentText ? currentText + '\n' + line : line
                            );
                        }
                        return;
                    }

                    if (msg.type === 'error') {
                        store.setError(msg.message || 'Transcribe error');
                        ui.setSttProgress({
                            status: 'Error ❌',
                            now: null,
                        });
                        es.close();
                        return;
                    }

                    if (msg.type === 'done') {
                        ui.setSttProgress({
                            progress: 100,
                            status: 'Done ✅',
                            now: null,
                            toast: null,
                        });
                        es.close();
                        return;
                    }
                } catch {
                    // ignore parse errors
                }
            };

            es.onerror = () => {
                ui.setSttProgress({
                    status: 'Connection error (SSE) ❌',
                    now: null,
                });
                es.close();
            };
        } catch (e: any) {
            store.setError(e.message || 'Start transcribe error');
            ui.setSttProgress({ status: 'Failed to start ❌' });
        }
    }, [store, ui, showToast]);

    const clearTranscription = useCallback(() => {
        store.setLectureText('');
        ui.resetStt();
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    }, [store, ui]);

    const cancelTranscription = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        ui.setSttProgress({
            status: 'Cancelled',
            now: null,
        });
    }, [ui]);

    return {
        // State from ui store
        stt: ui.stt,
        // Actions
        startTranscription,
        clearTranscription,
        cancelTranscription,
    };
}
