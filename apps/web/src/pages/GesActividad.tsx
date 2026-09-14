import { useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando, Tarjeta, Tabla, Etiqueta, type Columna, CabeceraPagina } from '../ui';

interface Traza {
  id: number; momento: string; usuario_id: string | null;
  accion: string; metodo: string | null; ruta: string | null; estado_http: number | null; ip: string | null;
}

function tono(estado: number | null): 'exito' | 'aviso' | 'error' | 'neutro' {
  if (estado == null) return 'neutro';
  if (estado >= 500) return 'error';
  if (estado >= 400) return 'aviso';
  return 'exito';
}

export function GesActividad() {
  const [filas, setFilas] = useState<Traza[] | null>(null);
  useEffect(() => { api.get<Traza[]>('/admin/registro-actividad').then(setFilas).catch(() => setFilas([])); }, []);

  const cols: Columna<Traza>[] = [
    { k: 'momento', txt: 'Momento', render: (t) => new Date(t.momento).toLocaleString('es-ES') },
    { k: 'accion', txt: 'Acción' },
    { k: 'ruta', txt: 'Recurso', render: (t) => <span className="num text-xs">{t.metodo} {t.ruta}</span> },
    { k: 'estado_http', txt: 'Estado', render: (t) => <Etiqueta tono={tono(t.estado_http)}>{t.estado_http ?? '—'}</Etiqueta> },
    { k: 'ip', txt: 'IP', render: (t) => <span className="num text-xs">{t.ip ?? '—'}</span> },
  ];

  return (
    <div>
      <CabeceraPagina titulo="Registro de actividad" descripcion="Trazas de acceso y acciones. Registro inmutable y separado del log funcional." />
      <Tarjeta titulo="Últimas trazas">
        {!filas ? <Cargando /> : <Tabla columnas={cols} filas={filas} vacio="Sin actividad registrada." />}
      </Tarjeta>
    </div>
  );
}
