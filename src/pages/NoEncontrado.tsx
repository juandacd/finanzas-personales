import { Link } from 'react-router-dom'

/** Página 404. */
export default function NoEncontrado() {
  return (
    <section className="text-center">
      <p className="text-5xl font-bold text-brand-500">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        Página no encontrada
      </h1>
      <p className="mt-2 text-slate-500">
        La página que buscas no existe o fue movida.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
      >
        Volver al inicio
      </Link>
    </section>
  )
}
