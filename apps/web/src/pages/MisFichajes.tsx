import { useEffect, useState, useCallback } from 'react';
import { api, descargar } from '../api';
import { Boton, Cargando, Etiqueta, Tarjeta, Tabla, minAHoras, type Columna, CabeceraPagina, Kpi } from '../ui';
import { mesActual, rangoDeMes } from '../fechas';
import { FicharWidget, ETIQUETA_FICHAJE } from '../FicharWidget';

interface Evento {
  id: string; tipo: string; origen: string;
  momento_servidor: string; momento_cliente: string | null;
  accion_correccion: string | null; motivo: string | null;
}
interface Dia { fecha: string; trabajadoMin: number; teoricoMin: number; saldoMin: number; esFestivo: boolean; esAusencia: boolean; extrasMin: number }
interface Total { dias: Dia[]; totales: { trabajadoMin: number; teoricoMin: number; saldoMin: number; extrasMin: number } }


export function MisFichajes() {
  const [mes, setMes] = useState(mesActual());
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [total, setTotal] = useState<Total | null>(null);
  const { desde, hasta } = rangoDeMes(mes);

  const cargar = useCallback(async () => {
    setEventos(null);
    // Ambas peticiones en paralelo (antes encadenadas).
    const [evs, tot] = await Promise.all([
      api.get<Evento[]>(`/horario/fichajes?desde=${desde}&hasta=${hasta}`).catch(() => [] as Evento[]),
      api.get<Total>(`/horario/totalizacion?desde=${desde}&hasta=${hasta}`).catch(() => null),
    ]);
    setEventos(evs); setTotal(tot);
  }, [desde, hasta]);
  useEffect(() => { void cargar(); }, [cargar]);

  const colsEventos: Columna<Evento>[] = [
    {
      k: 'momento', txt: 'Momento',
      render: (e) => new Date(e.momento_cliente ?? e.momento_servidor).toLocaleString('es-ES'),
    },
    { k: 'tipo', txt: 'Tipo', render: (e) => ETIQUETA_FICHAJE[e.tipo] ?? e.tipo },
    {
      k: 'origen', txt: 'Origen',
      render: (e) => e.origen === 'CORRECCION'
        ? <Etiqueta tono="aviso">Corrección · {e.accion_correccion}</Etiqueta>
        : <Etiqueta>{e.origen}</Etiqueta>,
    },
    { k: 'motivo', txt: 'Motivo', render: (e) => e.motivo ?? '' },
  ];

  const colsDias: Columna<Dia>[] = [
    { k: 'fecha', txt: 'Fecha' },
    { k: 'trabajadoMin', txt: 'Trabajado', alinear: 'der', render: (d) => minAHoras(d.trabajadoMin) },
    { k: 'teoricoMin', txt: 'Teórico', alinear: 'der', render: (d) => minAHoras(d.teoricoMin) },
    {
      k: 'saldoMin', txt: 'Saldo', alinear: 'der',
      render: (d) => <span className={d.saldoMin < 0 ? 'text-error' : d.saldoMin > 0 ? 'text-exito' : ''}>{minAHoras(d.saldoMin)}</span>,
    },
    {
      k: 'marca', txt: 'Observaciones',
      render: (d) => d.esAusencia ? <Etiqueta tono="marca">Ausencia</Etiqueta>
        : d.esFestivo ? <Etiqueta tono="aviso">Festivo</Etiqueta>
        : d.extrasMin > 0 ? <Etiqueta tono="exito">+{minAHoras(d.extrasMin)} extra</Etiqueta> : '',
    },
  ];

  return (
    <div>
      <CabeceraPagina titulo="Mis fichajes" descripcion="Registra tu jornada y consulta tu histórico." />

      <div className="mb-6">
        <Tarjeta titulo="Registrar jornada"><FicharWidget onFichado={cargar} /></Tarjeta>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label htmlFor="mes" className="block text-sm font-semibold mb-1.5">Periodo</label>
          <input id="mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)}
                 className="rounded-lg border border-linea bg-white px-3.5 py-2.5 focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 outline-none" />
        </div>
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={() => descargar(`/horario/informe.pdf?desde=${desde}&hasta=${hasta}`, `jornada_${mes}.pdf`)}>
            Informe PDF
          </Boton>
          <Boton variante="secundario" onClick={() => descargar(`/horario/informe.csv?desde=${desde}&hasta=${hasta}`, `jornada_${mes}.csv`)}>
            CSV
          </Boton>
        </div>
      </div>

      {total && (
        <section aria-label="Resumen del periodo" className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
          {[
            ['Trabajado', minAHoras(total.totales.trabajadoMin)],
            ['Jornada teórica', minAHoras(total.totales.teoricoMin)],
            ['Saldo', minAHoras(total.totales.saldoMin)],
            ['Horas extra', minAHoras(total.totales.extrasMin)],
          ].map(([t, v]) => <Kpi key={t} etiqueta={t!} valor={v!} />)}
        </section>
      )}

      <div className="grid gap-4">
        <Tarjeta titulo="Resumen por día">
          {!total ? <Cargando /> : <Tabla columnas={colsDias} filas={total.dias} vacio="Sin jornada registrada en el periodo." />}
        </Tarjeta>

        <Tarjeta titulo="Movimientos registrados">
          {!eventos ? <Cargando /> : (
            <Tabla columnas={colsEventos} filas={eventos} vacio="Aún no tienes fichajes en este periodo." />
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
