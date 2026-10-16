import { CategoryHub } from "@/components/CategoryHub";
import { PageShell } from "@/components/ui/PageShell";

export default function BuilderPage() {
  return (
    <PageShell title="Builder" subtitle="Crew zusammenstellen & Fusions-Piraten würfeln." accent="crew" fit>
      <CategoryHub group="builder" />
    </PageShell>
  );
}
