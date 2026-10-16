import { redirect } from "next/navigation";

// "Gegeneinander" (1-gegen-1-Duell) wurde entfernt — alte Links/Lesezeichen
// landen auf der Startseite statt auf einem 404.
export default function DuellPage() {
  redirect("/");
}
