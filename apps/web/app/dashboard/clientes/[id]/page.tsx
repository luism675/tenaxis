import { redirect } from "next/navigation";

type ClienteRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClienteRedirectPage({
  params,
}: ClienteRedirectPageProps) {
  const { id } = await params;

  redirect(`/dashboard/clientes/${id}/editar`);
}
