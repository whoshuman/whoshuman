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
    </main>
  );
}

export default DesignSystem;
