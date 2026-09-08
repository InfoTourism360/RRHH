import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './auth';

const ENLACES = [
  { a: '/', txt: 'Inicio' },
  { a: '/fichajes', txt: 'Mis fichajes' },
  { a: '/ausencias', txt: 'Mis ausencias' },
  { a: '/calendario', txt: 'Mi calendario' },
  { a: '/documentos', txt: 'Mis documentos' },
  { a: '/datos', txt: 'Mis datos' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { salir, yo } = useAuth();
  const loc = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Al cambiar de ruta, lleva el foco al contenido principal (accesibilidad SPA).
  useEffect(() => {
    mainRef.current?.focus();
  }, [loc.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#contenido" className="salto-contenido">Saltar al contenido principal</a>

      <header className="bg-marca text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <span className="font-bold text-lg">Portal del empleado</span>
          <button onClick={() => void salir()}
                  className="rounded bg-white/15 hover:bg-white/25 px-3 py-1.5 font-medium">
            Cerrar sesión
          </button>
        </div>
        <nav aria-label="Navegación principal" className="bg-marca-oscuro">
          <ul className="max-w-5xl mx-auto px-2 flex flex-wrap">
            {ENLACES.map((e) => (
              <li key={e.a}>
                <NavLink to={e.a} end={e.a === '/'}
                  className={({ isActive }) =>
                    `block px-3 py-2 border-b-4 ${isActive ? 'border-white font-semibold' : 'border-transparent hover:border-white/50'}`}
                  aria-current={undefined}>
                  {e.txt}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="contenido" ref={mainRef} tabIndex={-1}
            className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 outline-none">
        {children}
      </main>

      <footer className="bg-gray-100 text-gray-600 text-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>Entidad: {yo?.entidadId ? 'sesión activa' : '—'}</span>
          <a href="/accesibilidad" className="underline text-marca-oscuro">Declaración de accesibilidad</a>
        </div>
      </footer>
    </div>
  );
}
