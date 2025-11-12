// web/src/lib/api.ts
export const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function generateQuiz(count=4, lessonIds?: string[]) {
  const r = await fetch(`${API}/api/quiz/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count, lessonIds }),
  });
  return r.json(); // { id, items:[{id,type,prompt,...}] }
}

export async function submitQuiz(packId: string, answers: {id:string;answer:string|boolean}[]) {
  const r = await fetch(`${API}/api/quiz/${packId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  return r.json(); // { score, feedback, ... }
}

export async function getMemory() {
  const r = await fetch(`${API}/api/memory`);
  return r.json();
}

export async function getLessons() {
  const r = await fetch(`${API}/api/lessons`);
  return r.json();
}


export async function generateQuizFromLessonIds(lessonIds: string[], count = 6) {
  const r = await fetch(`${API}/api/quiz/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count, lessonIds })
  });
  return r.json();
}