import { ImuPageClient } from "@/components/ImuPageClient";
import { PageShell } from "@/components/ui/PageShell";

export default function ImuPage() {
  return (
    <PageShell title="Gegen Imu" accent="imu">
      <ImuPageClient />
    </PageShell>
  );
}
