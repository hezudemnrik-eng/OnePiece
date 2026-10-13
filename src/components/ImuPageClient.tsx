"use client";

import { useEffect, useState } from "react";
import { SoloDraftBoard } from "./SoloDraftBoard";
import { ImuIntro, hasSeenImuIntro } from "./ImuIntro";

export function ImuPageClient() {
  // null = not yet determined — avoids a flash of the intro (or of the
  // fight screen) before the client has had a chance to check localStorage,
  // same deferred-effect pattern used elsewhere for client-only state.
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => setShowIntro(!hasSeenImuIntro()));
  }, []);

  if (showIntro === null) return null;
  if (showIntro) return <ImuIntro onDone={() => setShowIntro(false)} />;

  return (
    <>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-danger">Imu kann nicht besiegt werden — angeblich.</p>
      <p className="text-sm text-black/60 dark:text-white/50 mb-6">
        Draft dein Team aus 5 Charakteren und tritt allein gegen Imu an — kein
        Team, sondern ein einzelner, sehr starker Boss-Gegner. Nur mit dem
        richtigen Build (S/A-Tier-Charaktere, gute Rollenverteilung) hast du
        auf &bdquo;Schwer&ldquo; überhaupt eine Chance, ihn zu verletzen.
      </p>
      <SoloDraftBoard opponentName="Imu" difficulty="schwer" flatBonus={5} topShare={0.6} storageKey="op-imu-runs" />
    </>
  );
}
