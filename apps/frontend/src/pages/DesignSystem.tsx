function DesignSystem() {
  return (
    <main className="main-container">
      {/* Cabecera de la guia visual: resume la direccion estetica acordada. */}
      <section className="content-section design-hero">
        <p className="design-kicker">Guia visual</p>

        <h1 className="design-title">Design System</h1>

        <p className="design-intro">
          Referencia visual de colores, tipografia, componentes y estilo retrowave de Who's Human.
        </p>
      </section>

      {/* Paleta base retrowave que usaremos como referencia para futuras pantallas. */}
      <section className="content-section">
        <h2 className="design-section-title">Colores</h2>

        <div className="grid grid-cols-4 gap-4">
          <article className="bg-surface border border-neon-cyan/30 p-4">
            <span className="mb-4 block h-20 bg-bg"></span>
            <h3 className="m-0 mb-1 text-base">Fondo noche</h3>
            <p className="m-0 text-sm text-text-muted">#050014</p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <span className="mb-4 block h-20 bg-surface"></span>
            <h3 className="m-0 mb-1 text-base">Superficie</h3>
            <p className="m-0 text-sm text-text-muted">#120a2a</p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <span className="mb-4 block h-20 bg-text-main"></span>
            <h3 className="m-0 mb-1 text-base">Texto principal</h3>
            <p className="m-0 text-sm text-text-muted">#fff7ff</p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <span className="mb-4 block h-20 bg-text-muted"></span>
            <h3 className="m-0 mb-1 text-base">Texto secundario</h3>
            <p className="m-0 text-sm text-text-muted">#c9b8ff</p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <span className="mb-4 block h-20 bg-neon-magenta"></span>
            <h3 className="m-0 mb-1 text-base">Neon magenta</h3>
            <p className="m-0 text-sm text-text-muted">#ff2bd6</p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <span className="mb-4 block h-20 bg-neon-cyan"></span>
            <h3 className="m-0 mb-1 text-base">Neon cyan</h3>
            <p className="m-0 text-sm text-text-muted">#24f5ff</p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <span className="mb-4 block h-20 bg-neon-violet"></span>
            <h3 className="m-0 mb-1 text-base">Neon violeta</h3>
            <p className="m-0 text-sm text-text-muted">#8b5cf6</p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <span className="mb-4 block h-20 bg-sun-orange"></span>
            <h3 className="m-0 mb-1 text-base">Sol naranja</h3>
            <p className="m-0 text-sm text-text-muted">#ff9f1c</p>
          </article>
        </div>
      </section>

      {/* Fuentes y escala tipografica inicial para titulos y textos. */}
      <section className="content-section">
        <h2 className="design-section-title">Tipografia</h2>

        <div className="grid gap-4">
          <article className="bg-surface border border-neon-cyan/30 p-4">
            <p className="m-0 mb-2 text-sm font-bold text-neon-magenta uppercase">Fuente display</p>
            <p className="font-[var(--font-display)] m-0 mb-2 text-3xl font-bold">Orbitron</p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <p className="m-0 mb-2 text-sm font-bold text-neon-magenta uppercase">Fuente base</p>
            <p className="m-0 mb-2 text-3xl font-semibold">Rajdhani</p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <p className="m-0 mb-2 text-sm font-bold text-neon-magenta uppercase">
              Titulo principal - h1
            </p>
            <h1 className="m-0 text-6xl leading-none">Who's Human</h1>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <p className="m-0 mb-2 text-sm font-bold text-neon-magenta uppercase">
              Titulo de seccion - h2
            </p>
            <h2 className="m-0 text-3xl leading-none">Colores</h2>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <p className="m-0 mb-2 text-sm font-bold text-neon-magenta uppercase">
              Titulo de bloque - h3
            </p>
            <h3 className="m-0 text-xl leading-tight">Neon magenta</h3>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <p className="m-0 mb-2 text-sm font-bold text-neon-magenta uppercase">Texto base - p</p>
            <p className="m-0 mb-2">
              Texto principal para descripciones y contenido general de la interfaz.
            </p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <p className="m-0 mb-2 text-sm font-bold text-neon-magenta uppercase">
              Texto secundario - p
            </p>
            <p className="m-0 mb-2">
              Texto de apoyo para detalles, estados o informacion menos importante.
            </p>
          </article>
        </div>
      </section>

      {/* Variantes visuales de botones; aun son ejemplos de guia, no componentes finales. */}
      <section className="content-section">
        <h2 className="design-section-title">Botones</h2>

        <div className="grid grid-cols-4 gap-4">
          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Primario</h3>
            <button
              className="bg-neon-magenta border-neon-magenta text-bg hover:brightness-110 active:translate-y-px w-full cursor-pointer border px-4 py-3 font-bold"
              type="button"
            >
              Acción principal
            </button>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Secundario</h3>
            <button
              className="text-neon-cyan border-neon-cyan hover:brightness-110 active:translate-y-px w-full cursor-pointer border bg-transparent px-4 py-3 font-bold"
              type="button"
            >
              Acción secundaria
            </button>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Peligro</h3>
            <button
              className="bg-sun-orange border-sun-orange text-bg hover:brightness-110 active:translate-y-px w-full cursor-pointer border px-4 py-3 font-bold"
              type="button"
            >
              Acción destructiva
            </button>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Desactivado</h3>
            <button
              className="w-full cursor-not-allowed border border-white/15 bg-white/10 px-4 py-3 font-bold text-white/45"
              type="button"
              disabled
            >
              Acción desactivada
            </button>
          </article>
        </div>
      </section>

      {/* Estados basicos de formulario para login, registro y futuras pantallas. */}
      <section className="content-section">
        <h2 className="design-section-title">Formularios</h2>

        <div className="design-form-list">
          <article className="design-form-item">
            <h3>Campo de texto</h3>

            <label htmlFor="design-text-input">Nombre del campo</label>
            <input
              className="design-input"
              id="design-text-input"
              type="text"
              placeholder="Texto de ejemplo"
            />
          </article>

          <article className="design-form-item">
            <h3>Campo con ayuda</h3>

            <label htmlFor="design-help-input">Nombre del campo</label>
            <input
              className="design-input"
              id="design-help-input"
              type="text"
              placeholder="Texto de ejemplo"
            />
            <p className="design-form-help">Texto de ayuda para explicar el campo.</p>
          </article>

          <article className="design-form-item">
            <h3>Campo con error</h3>

            <label htmlFor="design-error-input">Nombre del campo</label>
            <input
              className="design-input design-input-error"
              id="design-error-input"
              type="text"
              placeholder="Texto de ejemplo"
            />
            <p className="design-form-error">Mensaje de error del campo.</p>
          </article>

          <article className="design-form-item">
            <h3>Checkbox</h3>

            <label className="design-checkbox" htmlFor="design-checkbox-input">
              <input id="design-checkbox-input" type="checkbox" />
              Opcion seleccionable
            </label>
          </article>
        </div>
      </section>

      {/* Contenedores base para agrupar informacion en interfaces futuras. */}
      <section className="content-section">
        <h2 className="design-section-title">Paneles</h2>

        <div className="design-panel-list">
          <article className="design-panel">
            <h3>Panel base</h3>
            <p>Contenedor para agrupar informacion general de una pantalla.</p>
          </article>

          <article className="design-panel design-panel-featured">
            <h3>Panel destacado</h3>
            <p>Contenedor para informacion importante o acciones principales.</p>
          </article>

          <article className="design-panel design-panel-status">
            <h3>Panel de estado</h3>
            <p>Contenedor para mostrar estado de usuario, partida o conexion.</p>
          </article>
        </div>
      </section>

      {/* Etiquetas compactas para estados o metadatos sin definir aun pantallas concretas. */}
      <section className="content-section">
        <h2 className="design-section-title">Badges / etiquetas</h2>

        <div className="design-badge-list">
          <article className="design-badge-item">
            <h3>Informacion</h3>
            <span className="design-badge design-badge-info">Info</span>
          </article>

          <article className="design-badge-item">
            <h3>Exito</h3>
            <span className="design-badge design-badge-success">Exito</span>
          </article>

          <article className="design-badge-item">
            <h3>Aviso</h3>
            <span className="design-badge design-badge-warning">Aviso</span>
          </article>

          <article className="design-badge-item">
            <h3>Error</h3>
            <span className="design-badge design-badge-error">Error</span>
          </article>

          <article className="design-badge-item">
            <h3>Neutral</h3>
            <span className="design-badge design-badge-neutral">Neutral</span>
          </article>
        </div>
      </section>
    </main>
  );
}

export default DesignSystem;
