import { Link, Outlet } from "@tanstack/react-router";

function AppLayout() {
  return (
    <div>
      <header>
        <nav>
          <Link to="/">Inicio</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Registro</Link>
          <Link to="/lobby">Lobby</Link>
          <Link to="/game">Game</Link>
          <Link to="/design-system">Design System</Link>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer>
        <p>Footer placeholder</p>
      </footer>
    </div>
  );
}

export default AppLayout;
