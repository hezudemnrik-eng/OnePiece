"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { characters } from "@/lib/characters";
import {
  fetchLeaderboard,
  fetchMyRecentMatches,
  fetchOnlineFriends,
  fetchQuizLeaderboard,
  fetchRelevantLiveDrafts,
  getCurrentAuthUser,
  isSupabaseConfigured,
  type LeaderboardEntry,
  type MatchMode,
  type OnlineProfile,
  type OpenLiveDraft,
  type QuizLeaderboardEntry,
  type RecentMatch,
} from "@/lib/supabase";

const MODES: { href: string; icon: string; title: string; desc: string; matchMode?: MatchMode }[] = [
  { href: "/draft", icon: "⚔️", title: "PvP-Draft gegen Freunde", desc: "Snake-Draft im Hotseat, danach Kampfsimulation." },
  { href: "/draft/live", icon: "🌐", title: "Live-Draft (mehrere Geräte)", desc: "Lobby mit Code teilen, jeder draftet von seinem Gerät.", matchMode: "live-draft" },
  { href: "/imu", icon: "👁️", title: "Gegen Imu", desc: "Solo-Draft gegen einen übermächtigen Boss-Gegner.", matchMode: "imu" },
  { href: "/zufallsgegner", icon: "🎲", title: "Gegen Zufallsgegner", desc: "Ranked-Übungsrunde gegen eine leichtere KI.", matchMode: "zufallsgegner" },
  { href: "/duell", icon: "⚡", title: "Gegeneinander", desc: "1-gegen-1-Duell: zwei Charaktere, ein Sieger." },
  { href: "/crew", icon: "🧭", title: "Crew zusammenstellen", desc: "Pro Rolle einen zufälligen Charakter behalten oder neu würfeln, bis die Crew steht." },
  { href: "/fusion", icon: "🧬", title: "Fusions-Pirat", desc: "Teufelsfrucht, Haki, Body, Weapon, Race, Sensei & Mind würfeln — alle Picks auf einen Blick." },
  { href: "/blind-ranking", icon: "🙈", title: "Blind Ranking", desc: "Verdeckte Charaktere nach Thema einordnen, erst danach wird aufgedeckt." },
  { href: "/quiz", icon: "❓", title: "One-Piece-Quiz", desc: "Trivia zu Charakteren, Crews & Teufelsfrüchten — solo oder mit Freunden." },
  { href: "/tierlisten", icon: "📜", title: "Tierlisten", desc: "Charaktere, Arcs, Inseln & mehr in S–D einstufen und vergleichen." },
];

const MODE_LABELS: Record<MatchMode, string> = {
  imu: "Gegen Imu",
  zufallsgegner: "Gegen Zufallsgegner",
  "live-draft": "Live-Draft",
};

function avatarFor(id: string | null) {
  return id ? characters.find((c) => c.id === id) : null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

export function HomeOverview() {
  const [username, setUsername] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [quizLeaderboard, setQuizLeaderboard] = useState<QuizLeaderboardEntry[]>([]);
  const [recent, setRecent] = useState<RecentMatch[]>([]);
  const [online, setOnline] = useState<OnlineProfile[]>([]);
  const [liveDrafts, setLiveDrafts] = useState<OpenLiveDraft[]>([]);
  const [filter, setFilter] = useState<MatchMode | "alle">("alle");
  const [loaded, setLoaded] = useState(() => !isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    Promise.all([
      getCurrentAuthUser(),
      fetchLeaderboard(),
      fetchQuizLeaderboard(),
      fetchMyRecentMatches(10),
      fetchOnlineFriends(),
      fetchRelevantLiveDrafts(),
    ]).then(([user, board, quizBoard, matches, friends, drafts]) => {
      setUsername(user?.username ?? null);
      setMyUserId(user?.id ?? null);
      setLeaderboard(board);
      setQuizLeaderboard(quizBoard);
      setRecent(matches);
      setOnline(friends);
      setLiveDrafts(drafts);
      setLoaded(true);
    });
  }, []);

  const myStats = leaderboard.find((e) => e.userId === myUserId);
  const myLobbies = liveDrafts.filter((d) => d.isMine);
  const openLobbies = liveDrafts.filter((d) => !d.isMine && d.phase === "lobby");
  const filteredRecent = filter === "alle" ? recent : recent.filter((m) => m.mode === filter);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 flex flex-col gap-10">
      <div className="text-center">
        <p className="mb-2 text-sm uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">
          Privates Fan-Projekt
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl text-amber-700 dark:text-amber-400 mb-2">
          {username ? `Willkommen zurück, ${username}` : "One Piece Draft-App"}
        </h1>
        <p className="text-black/60 dark:text-white/50 max-w-lg mx-auto">
          Draft-Spiele, KI-Gegner und Tierlisten rund um One Piece – gebaut für den Freundeskreis.
        </p>
      </div>

      {isSupabaseConfigured() && loaded && (
        <>
          {myStats && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-[var(--surface)]/60 py-4">
                <p className="text-2xl font-bold text-emerald-600">{myStats.wins}</p>
                <p className="text-xs text-black/50 dark:text-white/40">Siege</p>
              </div>
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-[var(--surface)]/60 py-4">
                <p className="text-2xl font-bold text-rose-500">{myStats.losses}</p>
                <p className="text-xs text-black/50 dark:text-white/40">Niederlagen</p>
              </div>
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-[var(--surface)]/60 py-4">
                <p className="text-2xl font-bold text-amber-600">
                  {Math.round((myStats.wins / Math.max(1, myStats.wins + myStats.losses)) * 100)}%
                </p>
                <p className="text-xs text-black/50 dark:text-white/40">Winrate</p>
              </div>
            </div>
          )}

          {myLobbies.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
                Weiterspielen
              </h2>
              <div className="flex flex-col gap-2">
                {myLobbies.map((d) => (
                  <Link
                    key={d.id}
                    href={`/draft/live?code=${d.inviteCode}`}
                    className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm hover:border-amber-500"
                  >
                    <span>
                      Live-Draft <span className="font-mono">{d.inviteCode}</span> ·{" "}
                      {d.phase === "lobby" ? "wartet auf Spieler" : "läuft"} ({d.playerCount}/{d.maxPlayers})
                    </span>
                    <span className="text-amber-600 font-medium">Fortsetzen →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {(online.length > 0 || openLobbies.length > 0) && (
            <section className="grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
                  Online
                </h2>
                {online.length === 0 ? (
                  <p className="text-sm text-black/40 dark:text-white/30">Gerade niemand sonst online.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {online.map((p) => {
                      const avatar = avatarFor(p.avatarCharacterId);
                      return (
                        <li key={p.userId} className="flex items-center gap-2 text-sm">
                          <span className="relative">
                            {avatar?.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={avatar.imageUrl}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="h-7 w-7 rounded-full object-cover object-top"
                              />
                            ) : (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-700">
                                {p.username.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--background)]" />
                          </span>
                          {p.username}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
                  Offene Lobbys
                </h2>
                {openLobbies.length === 0 ? (
                  <p className="text-sm text-black/40 dark:text-white/30">Keine offenen Lobbys gerade.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {openLobbies.map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`/draft/live?code=${d.inviteCode}`}
                          className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm hover:border-amber-500"
                        >
                          <span className="font-mono">{d.inviteCode}</span>
                          <span className="text-black/50 dark:text-white/40">
                            {d.playerCount}/{d.maxPlayers} · {timeAgo(d.updatedAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {leaderboard.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
                Bestenliste
              </h2>
              <ol className="flex flex-col gap-1.5">
                {leaderboard.slice(0, 10).map((e, i) => {
                  const avatar = avatarFor(e.avatarCharacterId);
                  const isMe = e.userId === myUserId;
                  return (
                    <li
                      key={e.userId}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isMe ? "bg-amber-500/10 border border-amber-500/30" : "border border-transparent"}`}
                    >
                      <span className="w-5 text-right text-black/40 dark:text-white/30 font-mono">{i + 1}.</span>
                      {avatar?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-6 w-6 rounded-full object-cover object-top"
                        />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-amber-500/15" />
                      )}
                      <span className="flex-1 font-medium">
                        {e.username}
                        {isMe && " (du)"}
                      </span>
                      <span className="text-emerald-600">{e.wins}S</span>
                      <span className="text-rose-500">{e.losses}N</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {quizLeaderboard.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
                Quiz-Bestenliste
              </h2>
              <ol className="flex flex-col gap-1.5">
                {quizLeaderboard.slice(0, 10).map((e, i) => {
                  const avatar = avatarFor(e.avatarCharacterId);
                  const isMe = e.userId === myUserId;
                  const pct = Math.round((e.totalScore / Math.max(1, e.totalQuestions)) * 100);
                  return (
                    <li
                      key={e.userId}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isMe ? "bg-amber-500/10 border border-amber-500/30" : "border border-transparent"}`}
                    >
                      <span className="w-5 text-right text-black/40 dark:text-white/30 font-mono">{i + 1}.</span>
                      {avatar?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-6 w-6 rounded-full object-cover object-top"
                        />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-amber-500/15" />
                      )}
                      <span className="flex-1 font-medium">
                        {e.username}
                        {isMe && " (du)"}
                      </span>
                      <span className="text-black/50 dark:text-white/40">
                        {pct}% ({e.quizzesPlayed} Quizze)
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {recent.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
                  Letzte Partien
                </h2>
                <div className="flex gap-1.5">
                  {(["alle", "imu", "zufallsgegner", "live-draft"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded-full px-2.5 py-1 text-xs ${filter === f ? "bg-amber-600 text-white" : "border border-black/10 dark:border-white/10 text-black/50 dark:text-white/40"}`}
                    >
                      {f === "alle" ? "Alle" : MODE_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="flex flex-col gap-1.5">
                {filteredRecent.map((m, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm"
                  >
                    <span>
                      {MODE_LABELS[m.mode]}
                      {m.opponentLabel && <span className="text-black/50 dark:text-white/40"> vs. {m.opponentLabel}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={m.result === "win" ? "text-emerald-600 font-medium" : "text-rose-500 font-medium"}>
                        {m.result === "win" ? "Sieg" : "Niederlage"}
                      </span>
                      <span className="text-black/40 dark:text-white/30 text-xs">{timeAgo(m.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/40">
          Spielmodi
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {MODES.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group rounded-xl border border-black/10 dark:border-white/10 bg-[var(--surface)]/60 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-500 hover:shadow-lg"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-2xl" aria-hidden>
                  {l.icon}
                </span>
                <h3 className="font-semibold group-hover:text-amber-600 dark:group-hover:text-amber-400">{l.title}</h3>
              </div>
              <p className="text-sm text-black/60 dark:text-white/50">{l.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
