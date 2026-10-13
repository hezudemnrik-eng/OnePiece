"use client";

import { useState } from "react";
import {
  buildQuiz,
  QUIZ_CATEGORY_LABELS,
  QUIZ_SPOILER_SAGAS,
  type QuizCategory,
  type QuizDifficulty,
  type QuizQuestion,
} from "@/lib/quiz";
import { loadSeenQuestionIds, rememberQuestionIds } from "@/lib/quizHistory";
import { checkQuizAchievements, type QuizAchievement } from "@/lib/quizAchievements";
import { XP_ACHIEVEMENT_BONUS } from "@/lib/levels";
import { incrementXp, recordQuizResult, unlockAchievement } from "@/lib/supabase";
import { playAccept, playSkip, playWin, vibrate } from "@/lib/sfx";
import { useAnimationsEnabled } from "@/lib/animPrefs";
import { AnswerOption } from "./ui/AnswerOption";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Select } from "./ui/Select";

type Phase = "setup" | "playing" | "result";

const COUNT_CHOICES = [5, 10, 20, 50, 100];
const NO_SPOILER_LIMIT = "alle";

export function QuizSoloBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [category, setCategory] = useState<QuizCategory | "alle">("alle");
  const [difficulty, setDifficulty] = useState<QuizDifficulty | "alle">("alle");
  const [spoilerSaga, setSpoilerSaga] = useState<string>(NO_SPOILER_LIMIT);
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [newAchievements, setNewAchievements] = useState<QuizAchievement[]>([]);
  const [animationsEnabled] = useAnimationsEnabled();

  function start() {
    const maxArcIndex =
      spoilerSaga === NO_SPOILER_LIMIT ? undefined : QUIZ_SPOILER_SAGAS.find((s) => s.saga === spoilerSaga)?.maxArcIndex;
    const qs = buildQuiz(count, { category, difficulty, maxArcIndex }, Math.random, loadSeenQuestionIds());
    rememberQuestionIds(qs.map((q) => q.id));
    setQuestions(qs);
    setIndex(0);
    setAnswers([]);
    setSelected(null);
    setNewAchievements([]);
    setPhase("playing");
  }

  async function finalizeQuiz(score: number, total: number) {
    const earned = checkQuizAchievements(score, total, difficulty);
    if (earned.length === 0) return;
    const results = await Promise.all(earned.map(async (a) => ({ a, isNew: await unlockAchievement(a.id) })));
    const fresh = results.filter((r) => r.isNew).map((r) => r.a);
    if (fresh.length > 0) {
      incrementXp(fresh.length * XP_ACHIEVEMENT_BONUS);
      setNewAchievements(fresh);
    }
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
    setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex(index + 1);
        setSelected(null);
      } else {
        const score = nextAnswers.filter((a, i) => a === questions[i].correct).length;
        if (animationsEnabled && score >= questions.length * 0.6) playWin();
        recordQuizResult(score, questions.length, category, difficulty);
        finalizeQuiz(score, questions.length);
        setPhase("result");
      }
    }, 900);
  }

  function reset() {
    setPhase("setup");
  }

  if (phase === "setup") {
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
          <span className="text-xs text-black/50 dark:text-white/40">
            Betrifft nur Fragen zu Arcs/Inseln und deren Reihenfolge — Charakter- und Statfragen sind davon unabhängig.
          </span>
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
        <Button onClick={start}>Quiz starten</Button>
      </div>
    );
  }

  if (phase === "playing" && questions[index]) {
    const q = questions[index];
    return (
      <div className="flex flex-col gap-5 max-w-xl">
        <div className="flex items-center justify-between text-sm text-black/50 dark:text-white/40">
          <span>
            Frage {index + 1} / {questions.length}
          </span>
          <span>{QUIZ_CATEGORY_LABELS[q.category]}</span>
        </div>
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
              const showState = selected !== null;
              const state = showState && isCorrect ? "correct" : showState && isSelected ? "incorrect" : "idle";
              return (
                <AnswerOption key={i} state={state} onClick={() => choose(i)} disabled={selected !== null}>
                  {opt}
                </AnswerOption>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "result") {
    const score = answers.filter((a, i) => a === questions[i].correct).length;
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="flex flex-col gap-6 max-w-xl">
        <h2 className="text-xl font-semibold">
          {score} / {questions.length} richtig ({pct}%)
        </h2>
        {newAchievements.length > 0 && (
          <div className="op-pop-in rounded-xl border border-mode-quiz bg-mode-quiz/10 p-3">
            <p className="mb-1 text-sm font-semibold text-mode-quiz">🏆 Neue Erfolge freigeschaltet!</p>
            <ul className="flex flex-col gap-0.5 text-xs text-black/70 dark:text-white/60">
              {newAchievements.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.label}</span> — {a.description}
                </li>
              ))}
            </ul>
          </div>
        )}
        <ol className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <li
              key={q.id}
              className={`rounded-lg border p-3 text-sm ${answers[i] === q.correct ? "border-success/40" : "border-danger/40"}`}
            >
              <p className="font-medium">{q.prompt}</p>
              <p className="text-black/60 dark:text-white/50">
                Richtig: {q.options[q.correct]}
                {answers[i] !== q.correct && <> · Deine Antwort: {q.options[answers[i]]}</>}
              </p>
            </li>
          ))}
        </ol>
        <Button onClick={reset} className="self-start">
          Nochmal spielen
        </Button>
      </div>
    );
  }

  return null;
}
