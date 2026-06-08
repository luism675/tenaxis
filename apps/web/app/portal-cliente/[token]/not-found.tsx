import Link from "next/link";

export default function ClientPortalNotFound() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[72vh] max-w-2xl items-center justify-center">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#01ADFB]">
            Portal del cliente
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#021359]">
            Este enlace ya no está disponible
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Pedile a tu asesor un nuevo acceso para consultar tus visitas y el historial de atención.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-full bg-[#021359] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#031a78]"
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
