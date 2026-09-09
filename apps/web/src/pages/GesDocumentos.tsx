import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { Alerta, Boton, Campo, Selector, Tarjeta, Tabla, type Columna } from '../ui';
import { TIPOS_DOC, etiqueta } from '../catalogos';

interface Persona { id: string; nombre: string; apellido1: string; apellido2: string | null; num_documento: string }
interface Doc { id: string; tipo: string; titulo: string; nombre_fichero: string; publicado_en: string; ultima_descarga: string | null }

function leerBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function GesDocumentos() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [tipo, setTipo] = useState('NOMINA');
  const [titulo, setTitulo] = useState('');
  const [fichero, setFichero] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  useEffect(() => { api.get<Persona[]>('/estructura/personas').then((p) => { setPersonas(p); if (p[0]) setPersonaId(p[0].id); }).catch(() => {}); }, []);

  const cargarDocs = useCallback(async () => {
    if (!personaId) return;
    try { setDocs(await api.get<Doc[]>(`/portal/admin/documentos?personaId=${personaId}`)); } catch { setDocs([]); }
  }, [personaId]);
  useEffect(() => { void cargarDocs(); }, [cargarDocs]);

  async function publicar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!fichero) { setMsg({ tipo: 'error', texto: 'Selecciona un fichero PDF.' }); return; }
    try {
      const contenidoBase64 = await leerBase64(fichero);
      await api.post('/portal/documentos', {
        personaId, tipo, titulo: titulo || fichero.name,
        nombreFichero: fichero.name, mime: fichero.type || 'application/pdf', contenidoBase64,
      });
      setMsg({ tipo: 'exito', texto: 'Documento publicado. El empleado podrá descargarlo (con acuse).' });
      setTitulo(''); setFichero(null);
      (document.getElementById('fichero') as HTMLInputElement | null)?.value && ((document.getElementById('fichero') as HTMLInputElement).value = '');
      await cargarDocs();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo publicar.' });
    }
  }

  const cols: Columna<Doc>[] = [
    { k: 'titulo', txt: 'Título' },
    { k: 'tipo', txt: 'Tipo', render: (d) => etiqueta(TIPOS_DOC, d.tipo) },
    { k: 'publicado_en', txt: 'Publicado', render: (d) => new Date(d.publicado_en).toLocaleDateString('es-ES') },
    { k: 'acuse', txt: 'Acuse de descarga', render: (d) => d.ultima_descarga ? `Descargado ${new Date(d.ultima_descarga).toLocaleDateString('es-ES')}` : 'Pendiente' },
  ];

  return (
    <div>
      <h1 className="text-[26px] font-extrabold mb-1">Documentos del personal</h1>
      <p className="text-apagado mb-6">Publica documentación personal (incluidas nóminas en PDF). Cada descarga deja acuse.</p>
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.texto}</Alerta></div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Publicar documento">
          <form onSubmit={publicar} noValidate>
            <Selector etiqueta="Empleado/a" value={personaId} onChange={(e) => setPersonaId(e.target.value)} required>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} {p.apellido1} {p.apellido2 ?? ''} · {p.num_documento}</option>
              ))}
            </Selector>
            <Selector etiqueta="Tipo de documento" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_DOC.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
            </Selector>
            <Campo etiqueta="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} ayuda="Si lo dejas vacío, se usa el nombre del fichero." />
            <div className="mb-4">
              <label htmlFor="fichero" className="block text-sm font-semibold mb-1.5">Fichero (PDF)</label>
              <input id="fichero" type="file" accept="application/pdf"
                     onChange={(e) => setFichero(e.target.files?.[0] ?? null)}
                     className="block w-full text-sm text-apagado file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:text-marca-700 file:px-4 file:py-2 file:font-semibold" />
            </div>
            <Boton type="submit">Publicar</Boton>
          </form>
        </Tarjeta>

        <Tarjeta titulo="Documentos de la persona seleccionada">
          <Tabla columnas={cols} filas={docs} vacio="Sin documentos publicados." />
        </Tarjeta>
      </div>
    </div>
  );
}
