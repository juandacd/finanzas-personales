interface PlaceholderPageProps {
  titulo: string
  descripcion?: string
}

/** Página provisional para secciones aún sin contenido. */
export default function PlaceholderPage({
  titulo,
  descripcion,
}: PlaceholderPageProps) {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
      <p className="mt-2 text-slate-500">
        {descripcion ?? 'Esta sección estará disponible próximamente.'}
      </p>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
        Aún no hay nada por aquí.
      </div>
    </section>
  )
}
