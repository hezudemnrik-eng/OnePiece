import { redirect } from "next/navigation";

// "Gegen Zufallsgegner" wurde entfernt — alte Links/Lesezeichen landen auf
// der Startseite statt auf einem 404.
export default function ZufallsgegnerPage() {
  redirect("/");
}
