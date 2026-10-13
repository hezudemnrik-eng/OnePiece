"use client";

import { useState } from "react";
import { buildQuiz, QUIZ_CATEGORY_LABELS, type QuizCategory, type QuizDifficulty, type QuizQuestion } from "@/lib/quiz";
import { recordQuizResult } from "@/lib/supabase";
import { playAccept, playSkip, playWin, vibrate } from "@/lib/sfx";
import { useAnimationsEnabled } from "@/lib/animPrefs";

type Phase = "setup" | "playing" | "result";

const COUNT_CHOICES = [5, 10, 20, 50, 100];

export function QuizSoloBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [category, setCategory] = useState<QuizCategory | "alle">("alle");
  const [difficulty, setDifficulty] = useState<QuizDifficulty | "alle">("alle");
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [animationsEnabled] = useAnimationsEnabled();

  function start() {
    const qs = buildQuiz(count, { category, difficulty });
    setQuestions(qs);
    setIndex(0);
    setAnswers([]);
    setSelected(null);
    setPhase("playing");
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
        <button
          onClick={start}
          className="rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          Quiz starten
        </button>
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

  if (phase === "result") {
    const score = answers.filter((a, i) => a === questions[i].correct).length;
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="flex flex-col gap-6 max-w-xl">
        <h2 className="text-xl font-semibold">
          {score} / {questions.length} richtig ({pct}%)
        </h2>
        <ol className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <li
              key={q.id}
              className={`rounded-lg border p-3 text-sm ${answers[i] === q.correct ? "border-emerald-500/40" : "border-rose-500/40"}`}
            >
              <p className="font-medium">{q.prompt}</p>
              <p className="text-black/60 dark:text-white/50">
                Richtig: {q.options[q.correct]}
                {answers[i] !== q.correct && <> · Deine Antwort: {q.options[answers[i]]}</>}
              </p>
            </li>
          ))}
        </ol>
        <button
          onClick={reset}
          className="self-start rounded-md bg-amber-600 text-white px-4 py-2 font-medium hover:bg-amber-700"
        >
          Nochmal spielen
        </button>
      </div>
    );
  }

  return null;
}
