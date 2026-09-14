import { useEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import {
  IcoPanel, IcoReloj, IcoAusencias, IcoCalendario, IcoDoc, IcoUsuario,
  IcoSalir, IcoMenu, IcoCerrar, IcoInicio, IcoPlantilla, IcoActividad, IcoAprobar,
  IcoCampana, IcoAjustes, IcoLlave, IcoRPT,
} from './icons';

type Enlace = { a: string; txt: string; Ico: ComponentType<{ className?: string }> };

const NAV_EMPLEADO: Enlace[] = [
  { a: '/', txt: 'Inicio', Ico: IcoInicio },
  { a: '/fichajes', txt: 'Mis fichajes', Ico: IcoReloj },
  { a: '/ausencias', txt: 'Mis ausencias', Ico: IcoAusencias },
  { a: '/calendario', txt: 'Mi calendario', Ico: IcoCalendario },
  { a: '/documentos', txt: 'Mis documentos', Ico: IcoDoc },
  { a: '/avisos', txt: 'Mis avisos', Ico: IcoCampana },
  { a: '/datos', txt: 'Mis datos', Ico: IcoUsuario },
];
const NAV_GESTION: Enlace[] = [
  { a: '/', txt: 'Cuadro de mando', Ico: IcoPanel },
  { a: '/plantilla', txt: 'Plantilla', Ico: IcoPlantilla },
  { a: '/rpt', txt: 'RPT', Ico: IcoRPT },
  { a: '/control-horario', txt: 'Control horario', Ico: IcoReloj },
  { a: '/aprobaciones', txt: 'Aprobaciones', Ico: IcoAprobar },
  { a: '/publicaciones', txt: 'Documentos', Ico: IcoDoc },
  { a: '/accesos', txt: 'Accesos', Ico: IcoLlave },
  { a: '/configuracion', txt: 'Configuración', Ico: IcoAjustes },
  { a: '/actividad', txt: 'Actividad', Ico: IcoActividad },
  { a: '/inicio', txt: 'Mi espacio', Ico: IcoInicio },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { salir, yo } = useAuth();
  const loc = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [abierto, setAbierto] = useState(false);
  const esGestion = !!yo?.roles.some((r) => ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL'].includes(r.rol));
  const esAdmin = !!yo?.roles.some((r) => r.rol === 'ADMIN_ENTIDAD');
  // "Accesos" solo lo ve el administrador: repartir credenciales no es del gestor.
  const nav = esGestion
    ? (esAdmin ? NAV_GESTION : NAV_GESTION.filter((e) => e.a !== '/accesos'))
    : NAV_EMPLEADO;
  const rolTxt = esGestion ? 'Gestión de personal' : 'Empleado';

  useEffect(() => { mainRef.current?.focus(); setAbierto(false); }, [loc.pathname]);

  const Aside = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/15 text-white font-extrabold">GP</span>
        <div className="leading-tight">
          <div className="text-white font-bold">Gestión de Personal</div>
          <div className="text-[11px] text-white/75 tracking-wide uppercase">Sector público</div>
        </div>
        <button className="ml-auto lg:hidden text-white/80 hover:text-white w-11 h-11 grid place-items-center rounded-lg" onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"><IcoCerrar /></button>
      </div>

      <nav aria-label="Navegación principal" className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {nav.map((e) => (
            <li key={e.a}>
              <NavLink to={e.a} end={e.a === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                <e.Ico /> {e.txt}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-white/15 text-white text-sm font-semibold">
            {rolTxt.charAt(0)}
          </span>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{rolTxt}</div>
            <div className="text-white/70 text-xs truncate">Sesión activa</div>
          </div>
        </div>
        <button onClick={() => void salir()}
          className="mt-1 w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white">
          <IcoSalir /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr] bg-lienzo">
      <a href="#contenido" className="salto-contenido">Saltar al contenido principal</a>

      {/* Sidebar fijo en escritorio */}
      <aside className="hidden lg:block bg-marca-800 bg-gradient-to-b from-marca-700 to-marca-800">
        <div className="sticky top-0 h-screen">{Aside}</div>
      </aside>

      {/* Drawer móvil */}
      {abierto && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-tinta/50" onClick={() => setAbierto(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-72 bg-gradient-to-b from-marca-700 to-marca-800 shadow-flotante">
            {Aside}
          </div>
        </div>
      )}

      <div className="flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-linea flex items-center gap-3 px-4 lg:px-8">
          <button className="lg:hidden text-tinta -ml-2 w-11 h-11 grid place-items-center rounded-lg hover:bg-lienzo" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <IcoMenu />
          </button>
          <span className="lg:hidden font-bold">Gestión de Personal</span>
          <span className="ml-auto hidden sm:inline-flex items-center gap-2 text-xs font-medium text-apagado bg-lienzo border border-linea rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-exito" /> Entorno de demostración
          </span>
        </header>

        <main id="contenido" ref={mainRef} tabIndex={-1}
              className="flex-1 px-4 py-6 lg:px-8 lg:py-8 outline-none max-w-[1200px] w-full mx-auto">
          {children}
        </main>

        <footer className="px-4 lg:px-8 py-4 text-xs text-tenue flex flex-wrap gap-x-4 gap-y-1 justify-between border-t border-linea">
          <span>Datos de demostración · Registro horario inmutable · Sin datos biométricos</span>
          <a href="/accesibilidad" className="underline hover:text-marca-700">Declaración de accesibilidad</a>
        </footer>
      </div>
    </div>
  );
}
