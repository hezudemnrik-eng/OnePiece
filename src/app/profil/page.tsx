import { ProfileBoard } from "@/components/ProfileBoard";
import { PageShell } from "@/components/ui/PageShell";

export default function ProfilPage() {
  return (
    <PageShell
      title="Profil"
      subtitle="Dein Rang, Level-Fortschritt, freigeschaltete Profil-Rahmen und Fusions-Pirat-Erfolge."
      accent="accent"
    >
      <ProfileBoard />
    </PageShell>
  );
}
