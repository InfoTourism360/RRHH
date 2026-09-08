import { describe, it, expect } from 'vitest';
import { conTenant } from '../src/db/pool.js';
import * as est from '../src/domain/estructura.js';
import * as doc from '../src/domain/documentos.js';
import { crearEntidadDemo } from './helpers.js';

describe('Documentos del empleado', () => {
  it('publica, lista, descarga con acuse y es append-only', async () => {
    const a = await crearEntidadDemo('DOC');
    const ctx = { entidadId: a.entidadId, usuarioId: a.adminUsuarioId };
    const p = await est.crearPersona(ctx, { tipoDocumento: 'DNI', numDocumento: '20000001R', nombre: 'Doc', apellido1: 'Test' });

    const publicado = await doc.publicarDocumento(ctx, {
      personaId: p.id as string, tipo: 'NOMINA', titulo: 'Nómina marzo',
      nombreFichero: 'nomina_2025_03.pdf', contenido: Buffer.from('%PDF-1.4 contenido de prueba'),
    });
    expect(publicado.sha256).toHaveLength(64);

    const lista = await doc.listarDocumentos(ctx, p.id as string);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.ultima_descarga).toBeNull();

    const bajado = await doc.descargarDocumento(ctx, publicado.id as string, p.id as string, '127.0.0.1');
    expect(bajado.contenido.toString()).toContain('contenido de prueba');

    const acuses = await doc.acusesDocumento(ctx, publicado.id as string);
    expect(acuses).toHaveLength(1);

    // No es descargable por otra persona.
    const otra = await est.crearPersona(ctx, { tipoDocumento: 'DNI', numDocumento: '20000002W', nombre: 'Otra', apellido1: 'Persona' });
    await expect(doc.descargarDocumento(ctx, publicado.id as string, otra.id as string))
      .rejects.toMatchObject({ codigo: 'NO_AUTORIZADO' });

    // documento_personal es append-only para el rol de app.
    await expect(
      conTenant(ctx, async (ej) => { await ej.query('DELETE FROM documento_personal WHERE id = $1', [publicado.id]); }),
    ).rejects.toThrow(/permission denied|append-only/i);
  });
});
