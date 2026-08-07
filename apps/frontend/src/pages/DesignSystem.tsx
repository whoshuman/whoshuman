function DesignSystem() {
  // Se mantiene como constante para evitar repetir una utility larga en cada seccion.
  const sectionTitleClass =
    "font-display text-neon-cyan m-0 mb-6 text-3xl leading-none [text-shadow:0_0_18px_rgb(36_245_255_/_0.35)]";

  return (
    <main className="main-container">
      {/* Cabecera de la guia visual: resume la direccion estetica acordada. */}
      <section className="content-section max-w-3xl">
        <p className="font-display text-neon-magenta m-0 mb-3 text-sm font-bold tracking-wider uppercase">
          Guia visual
        </p>

        <h1 className="text-text-main font-display m-0 text-[clamp(2.25rem,8vw,4.5rem)] leading-none [text-shadow:0_0_18px_rgba(255,43,214,0.45),0_0_36px_rgba(36,245,255,0.24)]">
          Design System
        </h1>

        <p className="text-text-muted m-0 mt-4 text-lg leading-normal sm:text-2xl">
          Referencia visual de colores, tipografia, componentes y estilo retrowave de Who's Human.
        </p>
      </section>

      {/* Paleta base retrowave que usaremos como referencia para futuras pantallas. */}
      <section className="content-section">
        <h2 className={sectionTitleClass}>Colores</h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
        <h2 className={sectionTitleClass}>Tipografia</h2>

        <div className="grid gap-4">
          <article className="bg-surface border border-neon-cyan/30 p-4">
            <p className="m-0 mb-2 text-sm font-bold text-neon-magenta uppercase">Fuente display</p>
            <p className="font-display m-0 mb-2 text-3xl font-bold">Orbitron</p>
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
        <h2 className={sectionTitleClass}>Botones</h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
        <h2 className={sectionTitleClass}>Formularios</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Campo de texto</h3>

            <label className="text-text-muted mb-2 block text-sm" htmlFor="design-text-input">
              Nombre del campo
            </label>
            <input
              className="text-text-main border-neon-cyan/35 focus:border-neon-cyan focus:ring-neon-cyan/20 box-border w-full border bg-white/5 px-4 py-3 focus:ring-3 focus:outline-none"
              id="design-text-input"
              type="text"
              placeholder="Texto de ejemplo"
            />
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Campo con ayuda</h3>

            <label className="text-text-muted mb-2 block text-sm" htmlFor="design-help-input">
              Nombre del campo
            </label>
            <input
              className="text-text-main border-neon-cyan/35 focus:border-neon-cyan focus:ring-neon-cyan/20 box-border w-full border bg-white/5 px-4 py-3 focus:ring-3 focus:outline-none"
              id="design-help-input"
              type="text"
              placeholder="Texto de ejemplo"
            />
            <p className="text-text-muted m-0 mt-2 text-sm">
              Texto de ayuda para explicar el campo.
            </p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Campo con error</h3>

            <label className="text-text-muted mb-2 block text-sm" htmlFor="design-error-input">
              Nombre del campo
            </label>
            <input
              className="text-text-main border-sun-orange focus:border-sun-orange focus:ring-sun-orange/20 box-border w-full border bg-white/5 px-4 py-3 focus:ring-3 focus:outline-none"
              id="design-error-input"
              type="text"
              placeholder="Texto de ejemplo"
            />
            <p className="text-sun-orange m-0 mt-2 text-sm">Mensaje de error del campo.</p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Checkbox</h3>

            <label className="flex items-center" htmlFor="design-checkbox-input">
              <input
                className="accent-neon-magenta mr-3"
                id="design-checkbox-input"
                type="checkbox"
              />
              Opcion seleccionable
            </label>
          </article>
        </div>
      </section>

      {/* Contenedores base para agrupar informacion en interfaces futuras. */}
      <section className="content-section">
        <h2 className={sectionTitleClass}>Paneles</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="bg-surface border border-neon-cyan/30 p-5">
            <h3 className="m-0 mb-3 text-lg">Panel base</h3>
            <p className="text-text-muted m-0">
              Contenedor para agrupar informacion general de una pantalla.
            </p>
          </article>

          <article className="bg-surface border-neon-magenta shadow-[0_0_24px_rgba(255,43,214,0.18)] border p-5">
            <h3 className="m-0 mb-3 text-lg">Panel destacado</h3>
            <p className="text-text-muted m-0">
              Contenedor para informacion importante o acciones principales.
            </p>
          </article>

          <article className="bg-surface border-neon-cyan shadow-[0_0_24px_rgba(36,245,255,0.16)] border p-5">
            <h3 className="m-0 mb-3 text-lg">Panel de estado</h3>
            <p className="text-text-muted m-0">
              Contenedor para mostrar estado de usuario, partida o conexion.
            </p>
          </article>
        </div>
      </section>

      {/* Etiquetas compactas para estados o metadatos sin definir aun pantallas concretas. */}
      <section className="content-section">
        <h2 className={sectionTitleClass}>Badges / etiquetas</h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Informacion</h3>
            <span className="text-neon-cyan inline-flex items-center border border-current bg-neon-cyan/10 px-3 py-1 text-sm font-bold">
              Info
            </span>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Exito</h3>
            <span className="text-success inline-flex items-center border border-current bg-success/10 px-3 py-1 text-sm font-bold">
              Exito
            </span>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Aviso</h3>
            <span className="text-sun-orange inline-flex items-center border border-current bg-sun-orange/15 px-3 py-1 text-sm font-bold">
              Aviso
            </span>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Error</h3>
            <span className="text-error inline-flex items-center border border-current bg-error/15 px-3 py-1 text-sm font-bold">
              Error
            </span>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Neutral</h3>
            <span className="text-text-muted inline-flex items-center border border-current bg-white/10 px-3 py-1 text-sm font-bold">
              Neutral
            </span>
          </article>
        </div>
      </section>

      {/* Patrones de registro (introducidos con /friends): pestañas terminal, fila-expediente
          y estado vacío. Para cualquier pantalla que liste entidades del sistema. */}
      <section className="content-section">
        <h2 className={sectionTitleClass}>Registro / listas</h2>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Pestañas terminal</h3>
            <div className="flex border border-neon-cyan/30">
              <button
                type="button"
                className="flex-1 bg-neon-cyan/15 px-2 py-2.5 font-display text-xs font-black uppercase tracking-wider text-neon-cyan [text-shadow:0_0_12px_rgba(36,245,255,0.6)]"
              >
                Activa
              </button>
              <button
                type="button"
                className="flex-1 px-2 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-text-muted transition hover:text-neon-cyan"
              >
                Inactiva <span className="ml-1.5 text-neon-magenta">[3]</span>
              </button>
            </div>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4">
            <h3 className="m-0 mb-4 text-base">Estado vacío</h3>
            <p className="border border-neon-cyan/15 bg-black/20 px-4 py-6 text-center font-display text-xs font-bold uppercase tracking-[0.25em] text-text-muted/70">
              // SIN REGISTROS — INDICA LA ACCIÓN SIGUIENTE
            </p>
          </article>

          <article className="bg-surface border border-neon-cyan/30 p-4 lg:col-span-2">
            <h3 className="m-0 mb-4 text-base">Fila-expediente</h3>
            <div className="flex flex-col gap-3 border border-neon-cyan/20 bg-white/3 px-4 py-3 transition hover:border-neon-cyan/40 hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-neon-cyan/40 bg-neon-cyan/10 font-display text-sm font-black text-neon-cyan">
                  RV
                </span>
                <span className="min-w-0">
                  <span className="font-display block truncate text-sm font-bold text-text-main">
                    ROY-BATTY
                  </span>
                  <span className="block text-xs text-text-muted/80">Alta: nov 2019</span>
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="inline-flex border border-current bg-success/10 px-3 py-1 text-xs font-bold text-success">
                  VINCULADO
                </span>
                <button
                  type="button"
                  className="border border-sun-orange/60 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-sun-orange transition hover:bg-sun-orange/10"
                >
                  ELIMINAR
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

export default DesignSystem;
