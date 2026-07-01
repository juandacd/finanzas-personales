import { Link } from 'react-router-dom'
import SaldosIniciales from '@/components/SaldosIniciales'
import Categorias from '@/components/Categorias'

export default function Configuracion() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
        <p className="mt-2 text-slate-500">
          Ajustes de la aplicación y conexión con tu cuenta de Google.
        </p>
      </div>

      {/* Saldos iniciales */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Saldos iniciales
        </h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Fija el saldo con el que arranca cada cuenta y cada bolsillo. El total
          de cuentas debe cuadrar con el total de bolsillos.
        </p>
        <SaldosIniciales />
      </div>

      {/* Categorías */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Categorías</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Gestiona las categorías de ingreso y egreso. El bolsillo por defecto es
          opcional.
        </p>
        <Categorias />
      </div>

      {/* Diagnóstico */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Link
          to="/diagnostico"
          className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
        >
          <div>
            <p className="font-medium text-slate-900">Diagnóstico</p>
            <p className="text-sm text-slate-500">
              Verifica la conexión con Google (lectura y escritura).
            </p>
          </div>
          <span className="text-slate-400">→</span>
        </Link>
      </div>
    </section>
  )
}
