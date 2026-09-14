import { ownerPool, conTenant, cerrarPools } from '../db/pool.js';
import * as est from '../domain/estructura.js';
import * as aus from '../domain/ausencias.js';
import { publicarDocumento } from '../domain/documentos.js';
import { crearFestivo } from '../domain/calendario.js';
import { establecerPin } from '../auth/service.js';
import { hashearPassword } from '../auth/passwords.js';
import { generarNominaPDF } from '../domain/export/nomina.js';

// -----------------------------------------------------------------------------
// SEED de datos realista (NO datos de producción; script de arranque de demo).
// Ayuntamiento ficticio ~60 efectivos: mezcla funcionarios/laborales, plazas
// vacantes, una excedencia (con reserva) y una comisión de servicios.
// -----------------------------------------------------------------------------

const CIF = 'P4600001A';

const NOMBRES = ['Lucía','Martín','Carmen','Javier','Ana','Sergio','Elena','Pablo','Marta','David',
  'Laura','Miguel','Sara','Jorge','Nuria','Raúl','Cristina','Iván','Rosa','Alberto',
  'Isabel','Óscar','Beatriz','Rubén','Patricia','Andrés','Silvia','Diego','Teresa','Gonzalo'];
const APELLIDOS = ['García','Martínez','López','Sánchez','Pérez','Gómez','Fernández','Ruiz','Díaz','Moreno',
  'Muñoz','Álvarez','Romero','Alonso','Gutiérrez','Navarro','Torres','Domínguez','Gil','Serrano'];

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
function dni(n: number): string {
  const num = String(n).padStart(8, '0');
  return num + LETRAS_DNI[n % 23];
}

interface DefUnidad { codigo: string; denom: string; grupo: string; escala: string | null; nivel: number; }
const UNIDADES: DefUnidad[] = [
  { codigo: 'ALC', denom: 'Alcaldía', grupo: 'A1', escala: 'GENERAL', nivel: 30 },
  { codigo: 'SEC', denom: 'Secretaría General', grupo: 'A1', escala: 'GENERAL', nivel: 28 },
  { codigo: 'INT', denom: 'Intervención', grupo: 'A1', escala: 'GENERAL', nivel: 28 },
  { codigo: 'TES', denom: 'Tesorería', grupo: 'A2', escala: 'GENERAL', nivel: 24 },
  { codigo: 'RRHH', denom: 'Recursos Humanos', grupo: 'A2', escala: 'GENERAL', nivel: 22 },
  { codigo: 'POL', denom: 'Policía Local', grupo: 'C1', escala: 'ESPECIAL', nivel: 18 },
  { codigo: 'SSOC', denom: 'Servicios Sociales', grupo: 'A2', escala: 'ESPECIAL', nivel: 22 },
  { codigo: 'URB', denom: 'Urbanismo', grupo: 'A2', escala: 'ESPECIAL', nivel: 24 },
  { codigo: 'OBR', denom: 'Obras y Servicios', grupo: 'C2', escala: null, nivel: 14 },
  { codigo: 'CUL', denom: 'Cultura y Deportes', grupo: 'C1', escala: null, nivel: 16 },
];

async function main() {
  const existe = await ownerPool.query('SELECT id FROM entidad WHERE cif = $1', [CIF]);
  if ((existe.rowCount ?? 0) > 0) {
    console.log('El ayuntamiento de demo ya existe. Nada que sembrar.');
    return;
  }

  const ent = await ownerPool.query<{ id: string }>(
    `INSERT INTO entidad (cif, nombre, politicas)
     VALUES ($1, 'Entidad de demostración', '{"geocerca": false}'::jsonb) RETURNING id`,
    [CIF],
  );
  const entidadId = ent.rows[0]!.id;
  const ctx = { entidadId, usuarioId: null };

  // Usuario administrador (login de demo).
  const hash = await hashearPassword('Demo1234!');
  await ownerPool.query(
    `INSERT INTO usuario (entidad_id, email, password_hash) VALUES ($1, 'admin@demo.es', $2)`,
    [entidadId, hash],
  );
  await ownerPool.query(
    `INSERT INTO usuario_rol (entidad_id, usuario_id, rol_codigo)
     SELECT $1, id, 'ADMIN_ENTIDAD' FROM usuario WHERE entidad_id = $1 AND email = 'admin@demo.es'`,
    [entidadId],
  );

  // Unidades.
  const unidadIds: Record<string, string> = {};
  for (const u of UNIDADES) {
    const unidad = await est.crearUnidad(ctx, { codigo: u.codigo, denominacion: u.denom });
    unidadIds[u.codigo] = unidad.id as string;
  }

  const tipoFuncionario = (grupo: string) =>
    ['A1', 'A2'].includes(grupo) ? 'FUNC_CARRERA' : Math.random() < 0.5 ? 'FUNC_CARRERA' : 'LAB_FIJO';

  let nDoc = 1;
  let nPlaza = 1;
  const creados: { relId: string; puestoId: string; personaId: string; unidad: string }[] = [];

  // Reparto de ~58 efectivos ocupados por las unidades.
  const reparto: Record<string, number> = {
    ALC: 2, SEC: 4, INT: 5, TES: 3, RRHH: 3, POL: 12, SSOC: 8, URB: 6, OBR: 9, CUL: 6,
  };

  for (const u of UNIDADES) {
    for (let i = 0; i < (reparto[u.codigo] ?? 0); i++) {
      const plaza = await est.crearPlaza(ctx, {
        codigo: `PL-${String(nPlaza).padStart(4, '0')}`,
        denominacion: `Plaza ${u.denom} ${i + 1}`,
        grupoCodigo: u.grupo,
        escalaCodigo: u.escala,
        subescala: u.escala === 'ESPECIAL' ? 'Servicios Especiales' : u.escala === 'GENERAL' ? 'Técnica' : null,
      });
      const puesto = await est.crearPuesto(ctx, {
        plazaId: plaza.id as string,
        unidadId: unidadIds[u.codigo]!,
        codigo: `PT-${String(nPlaza).padStart(4, '0')}`,
        denominacion: `${u.denom} — puesto ${i + 1}`,
        nivelCd: u.nivel,
        formaProvision: u.nivel >= 28 ? 'LIBRE_DESIG' : 'CONCURSO',
        tipoJornada: 'COMPLETA',
      });
      const nombre = NOMBRES[nDoc % NOMBRES.length]!;
      const ap1 = APELLIDOS[(nDoc * 3) % APELLIDOS.length]!;
      const ap2 = APELLIDOS[(nDoc * 7) % APELLIDOS.length]!;
      const persona = await est.crearPersona(ctx, {
        tipoDocumento: 'DNI',
        numDocumento: dni(nDoc),
        nombre,
        apellido1: ap1,
        apellido2: ap2,
        emailCorp: `${nombre}.${ap1}${nDoc}@demo.es`.toLowerCase(),
      });
      const rel = await est.crearRelacion(ctx, {
        personaId: persona.id as string,
        puestoId: puesto.id as string,
        tipoCodigo: tipoFuncionario(u.grupo),
        situacionCodigo: 'SERV_ACTIVO',
        tomaPosesion: '2019-01-15',
      });
      creados.push({ relId: rel.id as string, puestoId: puesto.id as string, personaId: persona.id as string, unidad: u.codigo });
      nDoc++;
      nPlaza++;
    }
  }

  // 4 plazas VACANTES (con puesto RPT, sin ocupante).
  for (let i = 0; i < 4; i++) {
    const plaza = await est.crearPlaza(ctx, {
      codigo: `PL-${String(nPlaza).padStart(4, '0')}`,
      denominacion: `Plaza vacante ${i + 1}`,
      grupoCodigo: 'C1',
      escalaCodigo: 'GENERAL',
    });
    await est.crearPuesto(ctx, {
      plazaId: plaza.id as string,
      unidadId: unidadIds['OBR']!,
      codigo: `PT-${String(nPlaza).padStart(4, '0')}`,
      denominacion: `Puesto vacante ${i + 1}`,
      nivelCd: 16,
      formaProvision: 'CONCURSO',
      tipoJornada: 'COMPLETA',
    });
    nPlaza++;
  }

  // EXCEDENCIA (cuidado de familiares): titular conserva reserva -> libera puesto.
  const exced = creados.find((c) => c.unidad === 'SSOC')!;
  await est.cambiarSituacion(ctx, exced.relId, {
    situacionCodigo: 'EXCEDENCIA_CUID',
    desde: '2024-09-01',
    ocupaEfectivo: false,
    motivo: 'Excedencia por cuidado de hijo menor.',
  });
  // Interino que cubre el puesto liberado por la excedencia.
  const personaInterino = await est.crearPersona(ctx, {
    tipoDocumento: 'DNI', numDocumento: dni(nDoc++), nombre: 'Interino', apellido1: 'Sustituto', apellido2: 'Temporal',
  });
  await est.crearRelacion(ctx, {
    personaId: personaInterino.id as string,
    puestoId: exced.puestoId,
    tipoCodigo: 'FUNC_INTERINO',
    situacionCodigo: 'SERV_ACTIVO',
    tomaPosesion: '2024-09-02',
  });

  // COMISIÓN DE SERVICIOS: titular de URB pasa a un puesto de INT con reserva del origen.
  const comi = creados.find((c) => c.unidad === 'URB')!;
  const destino = creados.find((c) => c.unidad === 'INT')!;
  await est.cambiarSituacion(ctx, comi.relId, {
    situacionCodigo: 'COMISION_SERV',
    desde: '2025-02-01',
    ocupaEfectivo: false, // libera su puesto de origen (reserva)
    motivo: 'Comisión de servicios a Intervención.',
  });
  // Ocupa efectivamente un nuevo puesto en el destino (creamos plaza/puesto para él).
  const plazaDest = await est.crearPlaza(ctx, {
    codigo: `PL-${String(nPlaza).padStart(4, '0')}`, denominacion: 'Plaza comisión Intervención',
    grupoCodigo: 'A2', escalaCodigo: 'GENERAL',
  });
  const puestoDest = await est.crearPuesto(ctx, {
    plazaId: plazaDest.id as string, unidadId: unidadIds['INT']!,
    codigo: `PT-${String(nPlaza).padStart(4, '0')}`, denominacion: 'Técnico en comisión (Intervención)',
    nivelCd: 24, formaProvision: 'CONCURSO', tipoJornada: 'COMPLETA',
  });
  void destino;
  await est.crearRelacion(ctx, {
    personaId: comi.personaId,
    puestoId: puestoDest.id as string,
    tipoCodigo: 'FUNC_CARRERA',
    situacionCodigo: 'COMISION_SERV',
    tomaPosesion: '2025-02-01',
    ocupaEfectivo: true,
  });

  // --- Fase 3: catálogo de ausencias, calendario laboral y saldos ---
  await aus.precargarCatalogo(ctx);
  const anio = new Date().getFullYear(); // año en curso, para que la demo sea vigente
  const festivosMMDD: [string, string, string][] = [
    ['01-01', 'Año Nuevo', 'NACIONAL'],
    ['01-06', 'Epifanía del Señor', 'NACIONAL'],
    ['05-01', 'Fiesta del Trabajo', 'NACIONAL'],
    ['08-15', 'Asunción de la Virgen', 'NACIONAL'],
    ['10-12', 'Fiesta Nacional de España', 'NACIONAL'],
    ['11-01', 'Todos los Santos', 'NACIONAL'],
    ['12-06', 'Día de la Constitución', 'NACIONAL'],
    ['12-08', 'Inmaculada Concepción', 'NACIONAL'],
    ['12-25', 'Natividad del Señor', 'NACIONAL'],
    ['03-19', 'San José (autonómico)', 'AUTONOMICO'],
    ['06-24', 'Fiesta local', 'LOCAL'],
    ['09-08', 'Fiesta local', 'LOCAL'],
  ];
  for (const [mmdd, den, amb] of festivosMMDD) {
    await crearFestivo(ctx, { fecha: `${anio}-${mmdd}`, denominacion: den, ambito: amb });
  }
  // Saldos del año en curso (vacaciones 22 hábiles + 6 asuntos particulares).
  const personas = await conTenant(ctx, async (ej) =>
    (await ej.query<{ id: string }>('SELECT id FROM persona')).rows);
  for (const p of personas) {
    await aus.asignarSaldo(ctx, { personaId: p.id, tipoCodigo: 'VACACIONES', anio, dias: 22 });
    await aus.asignarSaldo(ctx, { personaId: p.id, tipoCodigo: 'ASUNTOS_PART', anio, dias: 6 });
  }

  // --- Fase 4: un usuario EMPLEADO real (con persona) para el portal ---
  const empleado = creados[0]!; // primera persona creada
  const hashEmp = await hashearPassword('Demo1234!');
  const ue = await ownerPool.query<{ id: string }>(
    `INSERT INTO usuario (entidad_id, persona_id, email, password_hash)
     VALUES ($1,$2,'empleado@demo.es',$3) RETURNING id`,
    [entidadId, empleado.personaId, hashEmp],
  );
  await ownerPool.query(
    `INSERT INTO usuario_rol (entidad_id, usuario_id, rol_codigo) VALUES ($1,$2,'EMPLEADO')`,
    [entidadId, ue.rows[0]!.id],
  );
  await establecerPin(ue.rows[0]!.id, '1234'); // PIN de quiosco de demo

  // Documento de demo: recibo de salarios con el formato real pero importes
  // ficticios (el propio PDF sale marcado como tal).
  const pdfDemo = await generarNominaPDF();
  await publicarDocumento(ctx, {
    personaId: empleado.personaId, tipo: 'NOMINA',
    titulo: 'Nómina de demostración (importes ficticios)',
    nombreFichero: 'nomina_demostracion.pdf', contenido: pdfDemo,
  });

  // Solicitudes de ausencia de ejemplo: varias pendientes de aprobación y una aprobada.
  const anioSol = new Date().getFullYear();
  const pendientesDe = [creados[3], creados[7], creados[12]].filter(Boolean);
  let d0 = 5;
  for (const c of pendientesDe) {
    await aus.solicitar(ctx, {
      personaId: c!.personaId, tipoCodigo: 'VACACIONES',
      fechaInicio: `${anioSol}-12-${String(d0).padStart(2, '0')}`,
      fechaFin: `${anioSol}-12-${String(d0 + 4).padStart(2, '0')}`,
    });
    d0 += 6;
  }
  // Una del propio empleado, aprobada, para poblar su calendario.
  const solEmp = await aus.solicitar(ctx, {
    personaId: empleado.personaId, tipoCodigo: 'ASUNTOS_PART',
    fechaInicio: `${anioSol}-11-24`, fechaFin: `${anioSol}-11-25`,
  });
  await aus.aprobar({ entidadId, usuarioId: ue.rows[0]!.id }, solEmp.id as string);

  const resumen = await conTenant(ctx, async (ej) => {
    const p = await ej.query('SELECT count(*) FROM persona');
    const v = await ej.query('SELECT count(*) FROM v_plaza_estado WHERE vacante');
    const ti = await ej.query('SELECT count(*) FROM tipo_ausencia');
    const fe = await ej.query('SELECT count(*) FROM calendario_festivo');
    return { personas: p.rows[0]!.count, plazasVacantes: v.rows[0]!.count,
             tiposAusencia: ti.rows[0]!.count, festivos: fe.rows[0]!.count };
  });

  console.log('Seed completado:', {
    entidad: 'Entidad de demostración', cif: CIF,
    adminLogin: 'admin@demo.es / Demo1234!',
    empleadoLogin: 'empleado@demo.es / Demo1234! (Quiosco: DNI 00000001R, PIN 1234)',
    ...resumen,
  });
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => cerrarPools());
