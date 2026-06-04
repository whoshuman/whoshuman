function DesignSystem() {
  return (
    <main className="main-container">
      <section className="content-section design-hero">
        <p className="design-kicker">Guia visual</p>

        <h1 className="design-title">Design System</h1>

        <p className="design-intro">
          Referencia visual de colores, tipografia, componentes y estilo retrowave de Who's Human.
        </p>
      </section>

      <section className="content-section">
        <h2 className="design-section-title">Colores</h2>

        <div className="design-color-grid">
          <article className="design-color-card">
            <span className="design-color-sample design-color-sample-bg"></span>
            <h3>Fondo noche</h3>
            <p>#050014</p>
          </article>

          <article className="design-color-card">
            <span className="design-color-sample design-color-sample-surface"></span>
            <h3>Superficie</h3>
            <p>#120a2a</p>
          </article>

          <article className="design-color-card">
            <span className="design-color-sample design-color-sample-text"></span>
            <h3>Texto principal</h3>
            <p>#fff7ff</p>
          </article>

          <article className="design-color-card">
            <span className="design-color-sample design-color-sample-muted"></span>
            <h3>Texto secundario</h3>
            <p>#c9b8ff</p>
          </article>

          <article className="design-color-card">
            <span className="design-color-sample design-color-sample-magenta"></span>
            <h3>Neon magenta</h3>
            <p>#ff2bd6</p>
          </article>

          <article className="design-color-card">
            <span className="design-color-sample design-color-sample-cyan"></span>
            <h3>Neon cyan</h3>
            <p>#24f5ff</p>
          </article>

          <article className="design-color-card">
            <span className="design-color-sample design-color-sample-violet"></span>
            <h3>Neon violeta</h3>
            <p>#8b5cf6</p>
          </article>

          <article className="design-color-card">
            <span className="design-color-sample design-color-sample-orange"></span>
            <h3>Sol naranja</h3>
            <p>#ff9f1c</p>
          </article>
        </div>
      </section>

      <section className="content-section">
        <h2 className="design-section-title">Tipografia</h2>

        <div className="design-typography-list">
          <article className="design-typography-item">
            <p className="design-typography-label">Fuente display</p>
            <p className="design-font-display">Orbitron</p>
          </article>

          <article className="design-typography-item">
            <p className="design-typography-label">Fuente base</p>
            <p className="design-font-base">Rajdhani</p>
          </article>

          <article className="design-typography-item">
            <p className="design-typography-label">Titulo principal - h1</p>
            <h1>Who's Human</h1>
          </article>

          <article className="design-typography-item">
            <p className="design-typography-label">Titulo de seccion - h2</p>
            <h2>Colores</h2>
          </article>

          <article className="design-typography-item">
            <p className="design-typography-label">Titulo de bloque - h3</p>
            <h3>Neon magenta</h3>
          </article>

          <article className="design-typography-item">
            <p className="design-typography-label">Texto base - p</p>
            <p>Texto principal para descripciones y contenido general de la interfaz.</p>
          </article>

          <article className="design-typography-item">
            <p className="design-typography-label">Texto secundario - p</p>
            <p>Texto de apoyo para detalles, estados o informacion menos importante.</p>
          </article>
        </div>
      </section>

      <section className="content-section">
        <h2 className="design-section-title">Botones</h2>

        <div className="design-button-list">
          <article className="design-button-item">
            <h3>Primario</h3>
            <button className="design-button design-button-primary" type="button">
              Acción principal
            </button>
          </article>

          <article className="design-button-item">
            <h3>Secundario</h3>
            <button className="design-button design-button-secondary" type="button">
              Acción secundaria
            </button>
          </article>

          <article className="design-button-item">
            <h3>Peligro</h3>
            <button className="design-button design-button-danger" type="button">
              Acción destructiva
            </button>
          </article>

          <article className="design-button-item">
            <h3>Desactivado</h3>
            <button className="design-button design-button-disabled" type="button" disabled>
              Acción desactivada
            </button>
          </article>
        </div>
      </section>

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
    </main>
  );
}

export default DesignSystem;
