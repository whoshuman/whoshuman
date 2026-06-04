function DesignSystem() {
  return (
    <main className="main-container">
      <section className="content-section">
        <p>Guia visual</p>

        <h1>Design System</h1>

        <p>
          Referencia visual de colores, tipografia, componentes y estilo retrowave de Who's Human.
        </p>
      </section>

      <section className="content-section">
        <h2>Colores</h2>

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
        <h2>Tipografia</h2>

        <div className="design-typography-list">
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
    </main>
  );
}

export default DesignSystem;
