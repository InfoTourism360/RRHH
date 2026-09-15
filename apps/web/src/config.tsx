import { useEffect, useState } from 'react';
import { api } from './api';

/**
 * Ajustes de presentación que decide el despliegue, no el código.
 *
 * `modoDemo` rotula la interfaz como entorno de demostración con datos
 * ficticios. Viene del servidor (`MODO_DEMO`) y no de una constante: el mismo
 * build sirve para la demostración y para la entidad que lo tiene contratado,
 * y en esta última el rótulo no debe aparecer.
 */
export interface Ajustes { modoDemo: boolean }

const POR_DEFECTO: Ajustes = { modoDemo: false };

let cache: Ajustes | null = null;
const suscritos = new Set<(a: Ajustes) => void>();
let pedido = false;

function pedirUnaVez() {
  if (pedido) return;
  pedido = true;
  api.get<Ajustes>('/config')
    // Si no se puede consultar, se asume producción: más vale no rotular de
    // demostración algo que no lo es que al revés.
    .catch(() => POR_DEFECTO)
    .then((a) => {
      cache = { modoDemo: !!a.modoDemo };
      suscritos.forEach((f) => f(cache!));
    });
}

export function useAjustes(): Ajustes {
  const [ajustes, setAjustes] = useState<Ajustes>(cache ?? POR_DEFECTO);
  useEffect(() => {
    if (cache) { setAjustes(cache); return; }
    suscritos.add(setAjustes);
    pedirUnaVez();
    return () => { suscritos.delete(setAjustes); };
  }, []);
  return ajustes;
}
