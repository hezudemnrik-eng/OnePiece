"use client";

import { useEffect, useRef, useState } from "react";
import { buildQuiz, QUIZ_CATEGORY_LABELS, type QuizCategory, type QuizDifficulty, type QuizQuestion } from "@/lib/quiz";
import {
  createQuizSession,
  fetchQuizParticipants,
  fetchQuizSessionByCode,
  getCurrentAuthUser,
  joinQuizSession,
  submitQuizScore,
  type QuizParticipant,
  type QuizSession,
} from "@/lib/supabase";
import { playAccept, playSkip, playWin, vibrate } from "@/lib/sfx";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { LoadingSpinner } from "./LoadingSpinner";

type View = "loading" | "home" | "create-form" | "join-form" | "playing" | "finished";
const COUNT_CHOICES = [5, 10, 20, 50, 100];

export function QuizLiveBoard() {
  const [view, setView] = useState<View>("loading");
  const [username, setUsername] = useState("Spieler");
  const [session, setSession] = useState<QuizSession | null>(null);
  const [participants, setParticipants] = useState<QuizParticipant[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [animationsEnabled] = useAnimationsEnabled();

  const [category, setCategory] = useState<QuizCategory | "alle">("alle");
  const [difficulty, setDifficulty] = useState<QuizDifficulty | "alle">("alle");
  const [count, setCount] = useState(10);
  const [codeInput, setCodeInput] = useState("");

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getCurrentAuthUser().then((u) => {
      if (u?.username) setUsername(u.username);
      setView("home");
    });
  }, []);

  function attachPolling(sessionId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchQuizParticipants(sessionId).then(setParticipants);
    }, 2500);
    fetchQuizParticipants(sessionId).then(setParticipants);
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleCreate() {
    setErrorMsg("");
    const qs = buildQuiz(count, { category, difficulty });
    const created = await createQuizSession(category, difficulty, qs);
    if (!created) {
      setErrorMsg("Konnte keine Lobby erstellen.");
      return;
    }
    await joinQuizSession(created.id, username);
    setSession(created);
    setQuestions(created.questions as QuizQuestion[]);
    attachPolling(created.id);
    setIndex(0);
    setAnswers([]);
    setSelected(null);
    setView("playing");
  }

  async function handleJoin() {
    setErrorMsg("");
    const found = await fetchQuizSessionByCode(codeInput);
    if (!found) {
      setErrorMsg("Kein Quiz mit diesem Code gefunden.");
      return;
    }
    await joinQuizSession(found.id, username);
    setSession(found);
    setQuestions(found.questions as QuizQuestion[]);
    attachPolling(found.id);
    setIndex(0);
    setAnswers([]);
    setSelected(null);
    setView("playing");
  }

  function choose(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    const correct = optionIndex === questions[index].correct;
    if (animationsEnabled) {
      if (correct) {
        playAccept();
        vibrate(25);
      } else {
        playSkip();
        vibrate([20, 40, 20]);
      }
    }
    const nextAnswers = [...answers, optionIndex];
    setAnswers(nextAnswers);
    setTimeout(async () => {
      if (index + 1 < questions.length) {
        setIndex(index + 1);
        setSelected(null);
      } else {
        const score = nextAnswers.filter((a, i) => a === questions[i].correct).length;
        if (animationsEnabled && score >= questions.length * 0.6) playWin();
        if (session) await submitQuizScore(session.id, score);
        setView("finished");
      }
    }, 900);
  }

  function backToHome() {
    if (pollRef.current) clearInterval(pollRef.current);
    setSession(null);
    setParticipants([]);
    setErrorMsg("");
    setView("home");
  }

  if (view === "loading") {
    return <LoadingSpinner label="Verbinde…" />;
  }

  if (view === "home") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Dein Name
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value || "Spieler")}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          />
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => setView("create-form")}
            className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
          >
            Lobby erstellen
          </button>
          <button
            onClick={() => setView("join-form")}
            className="rounded-md border border-black/15 dark:border-white/15 px-4 py-2 font-medium"
          >
            Mit Code beitreten
          </button>
        </div>
      </div>
    );
  }

  if (view === "create-form") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Kategorie
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as QuizCategory | "alle")}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          >
            <option value="alle">Alle Kategorien</option>
            {Object.entries(QUIZ_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Schwierigkeit
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as QuizDifficulty | "alle")}
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5"
          >
            <option value="alle">Alle Schwierigkeiten</option>
            <option value="leicht">Leicht</option>
            <option value="mittel">Mittel</option>
            <option value="schwer">Schwer</option>
          </select>
        </label>
        <div className="flex flex-col gap-1 text-sm">
          Anzahl Fragen
          <div className="flex gap-2">
            {COUNT_CHOICES.map((c) => (
              <button
                key={c}
                onClick={() => setCount(c)}
                className={`rounded-md border px-3 py-1.5 text-sm ${count === c ? "border-amber-500 bg-amber-500/10 font-semibold" : "border-black/15 dark:border-white/15"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {errorMsg && <p className="text-sm text-amber-600">{errorMsg}</p>}
        <div className="flex gap-3">
          <button onClick={handleCreate} className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700">
            Lobby erstellen & starten
          </button>
          <button onClick={() => setView("home")} className="text-sm text-black/50 dark:text-white/40">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  if (view === "join-form") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Einladungscode
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="z. B. AB3XQ9"
            className="rounded-md border border-black/15 dark:border-white/15 bg-white/70 dark:bg-white/5 px-3 py-1.5 font-mono uppercase"
          />
        </label>
        {errorMsg && <p className="text-sm text-amber-600">{errorMsg}</p>}
        <div className="flex gap-3">
          <button onClick={handleJoin} className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700">
            Beitreten & starten
          </button>
          <button onClick={() => setView("home")} className="text-sm text-black/50 dark:text-white/40">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  if (view === "playing" && session && questions[index]) {
    const q = questions[index];
    return (
      <div className="flex flex-col gap-5 max-w-xl">
        <div className="flex items-center justify-between text-sm text-black/50 dark:text-white/40">
          <span>
            Frage {index + 1} / {questions.length}
          </span>
          <span className="font-mono">{session.invite_code}</span>
        </div>
        <div className="op-parchment rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent p-6 flex flex-col items-center gap-4">
          {q.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={q.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-40 w-auto rounded-lg border border-amber-500/30 object-cover object-top shadow-lg"
            />
          )}
          <p className="text-center text-lg font-medium">{q.prompt}</p>
          <div className="grid w-full gap-2 sm:grid-cols-2">
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect = i === q.correct;
              const showState = selected !== null;
              return (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  disabled={selected !== null}
                  className={`rounded-md border px-4 py-2.5 text-sm text-left transition ${
                    showState && isCorrect
                      ? "border-emerald-500 bg-emerald-500/15 font-semibold"
                      : showState && isSelected && !isCorrect
                        ? "border-rose-500 bg-rose-500/15"
                        : "border-black/15 dark:border-white/15 hover:border-amber-500/50"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (view === "finished" && session) {
    const score = answers.filter((a, i) => a === questions[i].correct).length;
    return (
      <div className="flex flex-col gap-6 max-w-md">
        <h2 className="text-xl font-semibold">
          Fertig! {score} / {questions.length} richtig
        </h2>
        <div>
          <p className="mb-2 text-sm font-semibold">
            Bestenliste · Code <span className="font-mono">{session.invite_code}</span>
          </p>
          <ol className="flex flex-col gap-1.5">
            {participants.map((p, i) => (
              <li
                key={p.user_id}
                className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm"
              >
                <span>
                  {i + 1}. {p.username}
                </span>
                <span className="text-black/50 dark:text-white/40">
                  {p.score !== null ? `${p.score} / ${questions.length}` : "spielt noch…"}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <button onClick={backToHome} className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700">
          Zur Startseite
        </button>
      </div>
    );
  }

  return null;
}
