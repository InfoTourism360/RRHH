import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './Layout';
import { Cargando } from './ui';
import { Login } from './pages/Login';
import { Panel } from './pages/Panel';
import { GesPlantilla } from './pages/GesPlantilla';
import { GesRPT } from './pages/GesRPT';
import { GesAusencias } from './pages/GesAusencias';
import { GesDocumentos } from './pages/GesDocumentos';
import { GesActividad } from './pages/GesActividad';
import { GesHorario } from './pages/GesHorario';
import { GesConfiguracion } from './pages/GesConfiguracion';
import { Avisos } from './pages/Avisos';
import { GesUsuarios } from './pages/GesUsuarios';
import { Quiosco } from './pages/Quiosco';
import { Inicio } from './pages/Inicio';
import { MisFichajes } from './pages/MisFichajes';
import { MisAusencias } from './pages/MisAusencias';
import { MiCalendario } from './pages/MiCalendario';
import { MisDocumentos } from './pages/MisDocumentos';
import { MisDatos } from './pages/MisDatos';
import { Accesibilidad } from './pages/Accesibilidad';

export function App() {
  const { yo, cargando } = useAuth();
  const loc = useLocation();

  // El quiosco es un terminal compartido: se sirve sin sesión y sin el layout
  // de la aplicación, antes incluso de resolver la autenticación.
  if (loc.pathname === '/quiosco') return <Quiosco />;

  if (cargando) {
    return <div className="min-h-screen grid place-items-center"><Cargando /></div>;
  }

  if (!yo) {
    return (
      <Routes>
        <Route path="/accesibilidad" element={<Accesibilidad />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const esGestion = yo.roles.some((r) => ['ADMIN_ENTIDAD', 'GESTOR_PERSONAL'].includes(r.rol));
  const esAdmin = yo.roles.some((r) => r.rol === 'ADMIN_ENTIDAD');
  // El responsable de unidad resuelve las ausencias de su gente: necesita la
  // pantalla de aprobaciones aunque no sea gestión de personal.
  const esAprobador = esGestion || yo.roles.some((r) => r.rol === 'RESPONSABLE_UNIDAD');

  return (
    <Layout>
      <Routes>
        <Route path="/" element={esGestion ? <Panel /> : <Inicio />} />
        <Route path="/panel" element={<Panel />} />
        {esGestion && <Route path="/plantilla" element={<GesPlantilla />} />}
        {esGestion && <Route path="/rpt" element={<GesRPT />} />}
        {esGestion && <Route path="/control-horario" element={<GesHorario />} />}
        {esAprobador && <Route path="/aprobaciones" element={<GesAusencias />} />}
        {esGestion && <Route path="/publicaciones" element={<GesDocumentos />} />}
        {esGestion && <Route path="/configuracion" element={<GesConfiguracion />} />}
        {esGestion && <Route path="/actividad" element={<GesActividad />} />}
        {esAdmin && <Route path="/accesos" element={<GesUsuarios />} />}
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/avisos" element={<Avisos />} />
        <Route path="/fichajes" element={<MisFichajes />} />
        <Route path="/ausencias" element={<MisAusencias />} />
        <Route path="/calendario" element={<MiCalendario />} />
        <Route path="/documentos" element={<MisDocumentos />} />
        <Route path="/datos" element={<MisDatos />} />
        <Route path="/accesibilidad" element={<Accesibilidad />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
