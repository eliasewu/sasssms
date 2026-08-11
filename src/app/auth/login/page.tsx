import { redirect } from "next/navigation";

export default async function AuthLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  const qs = params.toString();
  redirect(qs ? `/login?${qs}` : "/login");
}
