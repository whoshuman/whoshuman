import HomeScene from "../features/home-3d/HomeScene";

function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg">
      <HomeScene />
      <section className="relative z-10">
        <p>
          Proyecto final 42 | Transcendence | Developed by: Jdelorme, smarin-a, zlu, descamil,
          ldiaz-ra
        </p>

        <h1>Who's Human</h1>

        <p>Engaña. Observa. Sobrevive.</p>
      </section>
    </main>
  );
}

export default Home;
