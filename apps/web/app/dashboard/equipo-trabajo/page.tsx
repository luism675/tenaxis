import { redirect } from "next/navigation";

type TeamPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const params = (await searchParams) ?? {};
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const destination =
    tabParam === "ranking"
      ? "/dashboard/equipo-trabajo/ranking"
      : "/dashboard/equipo-trabajo/usuarios";

  const nextParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (key === "tab" || value == null) {
      return;
    }

    const values = Array.isArray(value) ? value : [value];
    values.forEach((entry) => {
      if (entry) {
        nextParams.append(key, entry);
      }
    });
  });

  const query = nextParams.toString();
  redirect(query ? `${destination}?${query}` : destination);
}
