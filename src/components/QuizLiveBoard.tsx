"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildQuiz,
  QUIZ_CATEGORY_LABELS,
  QUIZ_SPOILER_SAGAS,
  type QuizCategory,
  type QuizDifficulty,
  type QuizQuestion,
} from "@/lib/quiz";
import { loadSeenQuestionIds, rememberQuestionIds } from "@/lib/quizHistory";
import {
  advanceQuizTurn,
  awardQuizTurnPoint,
  createQuizSession,
  fetchQuizParticipants,
  fetchQuizSession,
  fetchQuizSessionByCode,
  fetchQuizTurnOrder,
  finalizeQuizParticipant,
  getCurrentAuthUser,
  joinQuizSession,
  type QuizParticipant,
  type QuizSession,
} from "@/lib/supabase";
import { playAccept, playSkip, playWin, vibrate } from "@/lib/sfx";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { LoadingSpinner } from "./LoadingSpinner";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";

type View = "loading" | "home" | "create-form" | "join-form" | "playing" | "finished";
type TurnEntry = { userId: string; username: string };
const COUNT_CHOICES = [5, 10, 20, 50, 100];
const NO_SPOILER_LIMIT = "alle";
const POLL_MS = 2000;

export function QuizLiveBoard() {
  const [view, setView] = useState<View>("loading");
  const [username, setUsername] = useState("Spieler");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [participants, setParticipants] = useState<QuizParticipant[]>([]);
  const [turnOrder, setTurnOrder] = useState<TurnEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [animationsEnabled] = useAnimationsEnabled();

  const [category, setCategory] = useState<QuizCategory | "alle">("alle");
  const [difficulty, setDifficulty] = useState<QuizDifficulty | "alle">("alle");
  const [spoilerSaga, setSpoilerSaga] = useState<string>(NO_SPOILER_LIMIT);
  const [count, setCount] = useState(10);
  const [codeInput, setCodeInput] = useState("");

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalizedRef = useRef(false);
  const advancingRef = useRef(false);

  useEffect(() => {
    getCurrentAuthUser().then((u) => {
      if (u?.username) setUsername(u.username);
      setMyUserId(u?.id ?? null);
      setView("home");
    });
  }, []);

  function attachPolling(sessionId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    const tick = () => {
      Promise.all([fetchQuizSession(sessionId), fetchQuizParticipants(sessionId), fetchQuizTurnOrder(sessionId)]).then(
        ([s, p, t]) => {
          if (s) setSession(s);
          setParticipants(p);
          setTurnOrder(t);
        }
      );
    };
    pollRef.current = setInterval(tick, POLL_MS);
    tick();
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleCreate() {
    setErrorMsg("");
    const maxArcIndex =
      spoilerSaga === NO_SPOILER_LIMIT ? undefined : QUIZ_SPOILER_SAGAS.find((s) => s.saga === spoilerSaga)?.maxArcIndex;
    const qs = buildQuiz(count, { category, difficulty, maxArcIndex }, Math.random, loadSeenQuestionIds());
    rememberQuestionIds(qs.map((q) => q.id));
    const created = await createQuizSession(category, difficulty, qs);
    if (!created) {
      setErrorMsg("Konnte keine Lobby erstellen.");
      return;
    }
    await joinQuizSession(created.id, username);
    setSession(created);
    setQuestions(qs);
    finalizedRef.current = false;
    setSelected(null);
    attachPolling(created.id);
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
    finalizedRef.current = false;
    setSelected(null);
    attachPolling(found.id);
    setView("playing");
  }

  const currentIndex = session?.current_index ?? 0;
  const activeEntry = turnOrder.length > 0 ? turnOrder[currentIndex % turnOrder.length] : null;
  const isMyTurn = activeEntry?.userId === myUserId;
  const gameOver = currentIndex >= questions.length && questions.length > 0;

  // Game-end detection is purely reactive (poll -> currentIndex), the same
  // for every participant regardless of whose turn it was last — so each
  // client finalizes its own XP exactly once rather than relying on one
  // designated "last answerer" to do it for everyone.
  useEffect(() => {
    if (gameOver && !finalizedRef.current && session) {
      finalizedRef.current = true;
      finalizeQuizParticipant(session.id).then(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        setView("finished");
      });
    }
  }, [gameOver, session]);

  async function choose(optionIndex: number) {
    if (selected !== null || !isMyTurn || !session) return;
    setSelected(optionIndex);
    const correct = optionIndex === questions[currentIndex].correct;
    if (animationsEnabled) {
      if (correct) {
        playAccept();
        vibrate(25);
      } else {
        playSkip();
        vibrate([20, 40, 20]);
      }
    }
    if (currentIndex + 1 >= questions.length && animationsEnabled && correct) playWin();
    await awardQuizTurnPoint(session.id, correct);
    if (!advancingRef.current) {
      advancingRef.current = true;
      await advanceQuizTurn(session.id, currentIndex);
      advancingRef.current = false;
    }
    setTimeout(() => setSelected(null), 900);
  }

  function backToHome() {
    if (pollRef.current) clearInterval(pollRef.current);
    setSession(null);
    setParticipants([]);
    setTurnOrder([]);
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
          <Input value={username} onChange={(e) => setUsername(e.target.value || "Spieler")} />
        </label>
        <div className="flex gap-3">
          <Button onClick={() => setView("create-form")}>Lobby erstellen</Button>
          <Button variant="secondary" onClick={() => setView("join-form")}>
            Mit Code beitreten
          </Button>
        </div>
      </div>
    );
  }

  if (view === "create-form") {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1 text-sm">
          Kategorie
          <Select value={category} onChange={(e) => setCategory(e.target.value as QuizCategory | "alle")}>
            <option value="alle">Alle Kategorien</option>
            {Object.entries(QUIZ_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Schwierigkeit
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as QuizDifficulty | "alle")}>
            <option value="alle">Alle Schwierigkeiten</option>
            <option value="leicht">Leicht</option>
            <option value="mittel">Mittel</option>
            <option value="schwer">Schwer</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Spoiler-Schutz: nur bis einschließlich…
          <Select value={spoilerSaga} onChange={(e) => setSpoilerSaga(e.target.value)}>
            <option value={NO_SPOILER_LIMIT}>Keine Einschränkung (ganze Story)</option>
            {QUIZ_SPOILER_SAGAS.map((s) => (
              <option key={s.saga} value={s.saga}>
                {s.saga}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex flex-col gap-1 text-sm">
          Anzahl Fragen
          <div className="flex gap-2">
            {COUNT_CHOICES.map((c) => (
              <button
                key={c}
                onClick={() => setCount(c)}
                className={`rounded-md border px-3 py-1.5 text-sm ${count === c ? "border-mode-quiz bg-mode-quiz/10 font-semibold" : "border-black/15 dark:border-white/15"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-black/50 dark:text-white/40">
          Reihum: Jede Frage ist für alle sichtbar, aber nur der/die Spieler:in am Zug darf antworten.
        </p>
        {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}
        <div className="flex gap-3">
          <Button onClick={handleCreate}>Lobby erstellen & starten</Button>
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
          <Input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="z. B. AB3XQ9"
            className="font-[family-name:var(--font-mono)] uppercase"
          />
        </label>
        {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}
        <div className="flex gap-3">
          <Button onClick={handleJoin}>Beitreten & starten</Button>
          <button onClick={() => setView("home")} className="text-sm text-black/50 dark:text-white/40">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  if (view === "playing" && session && questions[currentIndex] && !gameOver) {
    const q = questions[currentIndex];
    return (
      <div className="flex flex-col gap-5 max-w-xl">
        <div className="flex items-center justify-between text-sm text-black/50 dark:text-white/40">
          <span>
            Frage {currentIndex + 1} / {questions.length}
          </span>
          <span className="font-[family-name:var(--font-mono)]">{session.invite_code}</span>
        </div>
        <p className={`text-sm font-medium ${isMyTurn ? "text-mode-quiz" : "text-black/60 dark:text-white/50"}`}>
          {isMyTurn ? "Du bist dran!" : `${activeEntry?.username ?? "…"} ist dran — schau zu.`}
        </p>
        <Card variant="spotlight" accent="quiz" className="flex flex-col items-center gap-4">
          {q.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={q.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-40 w-auto rounded-lg border border-mode-quiz/30 object-cover object-top shadow-lg"
            />
          )}
          <p className="text-center text-lg font-medium">{q.prompt}</p>
          <div className="grid w-full gap-2 sm:grid-cols-2">
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect = i === q.correct;
              const showState = isMyTurn && selected !== null;
              return (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  disabled={!isMyTurn || selected !== null}
                  className={`rounded-md border px-4 py-2.5 text-sm text-left transition ${
                    showState && isCorrect
                      ? "border-success bg-success/15 font-semibold"
                      : showState && isSelected && !isCorrect
                        ? "border-danger bg-danger/15"
                        : isMyTurn
                          ? "border-black/15 dark:border-white/15 hover:border-mode-quiz/50"
                          : "border-black/10 dark:border-white/10 opacity-50 cursor-default"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </Card>
        <div className="flex flex-wrap gap-2">
          {turnOrder.map((t, i) => (
            <span
              key={t.userId}
              className={`rounded-full px-2.5 py-1 text-xs ${
                i === currentIndex % turnOrder.length
                  ? "bg-mode-quiz text-white font-semibold"
                  : "border border-black/10 dark:border-white/10 text-black/50 dark:text-white/40"
              }`}
            >
              {t.username}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (view === "finished" && session) {
    return (
      <div className="flex flex-col gap-6 max-w-md">
        <h2 className="text-xl font-semibold">Quiz beendet!</h2>
        <div>
          <p className="mb-2 text-sm font-semibold">
            Bestenliste · Code <span className="font-[family-name:var(--font-mono)]">{session.invite_code}</span>
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
                  {p.score !== null ? `${p.score} / ${questions.length}` : "0"}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <Button onClick={backToHome} className="self-start">
          Zur Startseite
        </Button>
      </div>
    );
  }

  return <LoadingSpinner label="Warte auf Mitspieler…" />;
}
