import { redirect } from "next/navigation";

// PvP-Draft gegen Freunde (Hotseat) wurde entfernt — alte Links/Lesezeichen
// landen auf der Startseite statt auf einem 404.
export default function DraftPage() {
  redirect("/");
}
