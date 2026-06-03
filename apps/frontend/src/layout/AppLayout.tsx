import { Link, Outlet } from "react-router-dom";

function AppLayout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <nav className="app-nav">
          <Link to="/">Inicio</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Registro</Link>
          <Link to="/lobby">Lobby</Link>
          <Link to="/game">Game</Link>
        </nav>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <p>Footer placeholder</p>
      </footer>
    </div>
  );
}

export default AppLayout;
