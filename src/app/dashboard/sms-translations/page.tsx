import { permanentRedirect } from "next/navigation";

export default function OldSmsTranslationsPage() {
  permanentRedirect("/dashboard/translations/sid");
}
