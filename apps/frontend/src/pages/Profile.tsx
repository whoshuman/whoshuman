import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiError } from "../shared/api/errors";
import { deleteMe, getMe } from "../shared/api/users";
import { useAuthStore } from "../shared/authStore";
import ProfileEdit from "./ProfileEdit";

function Profile() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const storedUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const signOut = useAuthStore((s) => s.signOut);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Server state con React Query: el store da render instantáneo (initialData) y
  // la query revalida contra el backend en segundo plano.
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: isAuthenticated,
    initialData: storedUser ?? undefined
  });

  // Sincroniza el store cuando el servidor trae datos más recientes (p. ej. el
  // perfil se editó desde otro dispositivo). updatedAt evita re-persistir en bucle.
  useEffect(() => {
    if (user && user.updatedAt !== storedUser?.updatedAt) {
      updateUser(user);
    }
  }, [user, storedUser?.updatedAt, updateUser]);

  if (!isAuthenticated) {
    // Sin refresh token no hay sesión que restaurar: fuera.
    if (!localStorage.getItem("refreshToken")) {
      return <Navigate to="/login" />;
    }
    // restore() (lanzado por AppLayout) sigue en vuelo: pantalla de verificación.
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <p className="font-display animate-pulse text-sm font-bold uppercase tracking-[0.3em] text-neon-cyan">
          // {t("profilePage.identifying")}
        </p>
      </main>
    );
  }

  if (!user) return null;

  const initials =
    user.username
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 2)
      .toUpperCase() || "JD";

  const memberSince = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(user.createdAt));

  async function handleLogout() {
    await signOut();
    void navigate({ to: "/" });
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteMe();
      // Cuenta ya borrada en el servidor: signOut limpia lo local (su llamada de
      // logout puede fallar con tokens ya inválidos — la ignora por diseño).
      await signOut();
      void navigate({ to: "/" });
    } catch (err) {
      setDeleteError(apiError(err, t("profilePage.deleteAccount")));
      setDeleting(false);
    }
  }

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[32rem] w-[32rem] bg-neon-cyan/8 blur-3xl" />
      </div>

      <div className="animate-unfold-down relative w-full max-w-2xl origin-top border border-neon-cyan/50 bg-surface shadow-[0_0_48px_rgba(36,245,255,0.18),inset_0_0_48px_rgba(36,245,255,0.03)]">
        {/* Cabecera terminal */}
        <div className="border-b border-neon-cyan/30 bg-neon-cyan/8 px-6 py-3 sm:px-10">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("profilePage.eyebrow")}
          </p>
        </div>

        {/* Esquinas decorativas */}
        <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-neon-magenta" />
        <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-neon-magenta" />
        <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-neon-magenta" />
        <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-neon-magenta" />

        <div className="px-6 py-8 sm:px-10">
          {/* Identidad: avatar de iniciales + callsign */}
          <div className="mb-8 flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center border-2 border-neon-cyan/40 bg-neon-cyan/10 font-display text-3xl font-black text-neon-cyan [text-shadow:0_0_14px_rgba(36,245,255,0.6)]">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="font-display truncate text-[clamp(1.5rem,6vw,2.25rem)] font-black uppercase leading-none text-text-main [text-shadow:0_0_18px_rgba(255,43,214,0.45),0_0_36px_rgba(36,245,255,0.24)]">
                {user.username}
              </h1>
              <p className="mt-2 text-sm text-text-muted">{t("profilePage.subtitle")}</p>
            </div>
          </div>

          {/* Datos de la unidad */}
          <dl className="mb-8 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="font-display text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan/80">
                {t("profilePage.emailLabel")}
              </dt>
              <dd className="mt-1 break-all text-text-main">{user.email}</dd>
            </div>
            <div>
              <dt className="font-display text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan/80">
                {t("profilePage.sinceLabel")}
              </dt>
              <dd className="mt-1 text-text-main">{memberSince}</dd>
            </div>
            <div>
              <dt className="font-display text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan/80">
                {t("profilePage.languageLabel")}
              </dt>
              <dd className="mt-1">
                <span className="inline-flex border border-current bg-neon-violet/10 px-3 py-1 text-sm font-bold text-neon-violet">
                  {user.language.toUpperCase()}
                </span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-display text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan/80">
                {t("profilePage.bioLabel")}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-text-main">{user.bio || "—"}</dd>
            </div>
          </dl>

          {/* Registro de combate: placeholder hasta que backend exponga stats */}
          <div className="mb-8 border border-neon-cyan/25 bg-black/20 px-5 py-4">
            <p className="font-display mb-3 text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan/80">
              // {t("profilePage.statsTitle")}
            </p>
            <span className="inline-flex border border-current bg-white/5 px-3 py-1 text-sm font-bold text-text-muted/60">
              {t("profilePage.statsEmpty")}
            </span>
            <p className="mt-3 text-xs text-text-muted/70">{t("profilePage.statsPending")}</p>
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex-1 border-2 border-neon-cyan px-6 py-3 font-display font-black uppercase tracking-widest text-neon-cyan shadow-[0_0_20px_rgba(36,245,255,0.35)] transition hover:brightness-125 hover:shadow-[0_0_36px_rgba(36,245,255,0.55)] active:translate-y-px"
            >
              {t("profilePage.edit")}
            </button>
            <Link
              to="/friends"
              className="border-2 border-neon-violet px-6 py-3 text-center font-display font-black uppercase tracking-widest text-neon-violet transition hover:bg-neon-violet/10 active:translate-y-px"
            >
              {t("profilePage.contacts")}
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="border-2 border-sun-orange bg-sun-orange px-6 py-3 font-display font-black uppercase tracking-widest text-bg transition hover:brightness-110 active:translate-y-px"
            >
              {t("profilePage.logout")}
            </button>
          </div>

          {/* Zona de peligro: baja definitiva de la unidad (DELETE /users/me). */}
          <div className="mt-8 border border-error/40 bg-error/5 px-5 py-4">
            <p className="font-display mb-2 text-xs font-bold uppercase tracking-[0.25em] text-error">
              // {t("profilePage.dangerTitle")}
            </p>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="border border-error/60 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-error transition hover:bg-error/10"
              >
                {t("profilePage.deleteAccount")}
              </button>
            ) : (
              <div>
                <p className="mb-3 text-sm text-text-muted">{t("profilePage.deleteWarning")}</p>
                {deleteError && (
                  <p className="mb-3 text-sm font-bold text-error">// {deleteError}</p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                    className="border-2 border-error bg-error px-4 py-2 font-display text-xs font-black uppercase tracking-wider text-bg transition hover:brightness-110 disabled:opacity-50"
                  >
                    {t("profilePage.deleteConfirm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="border border-neon-cyan/50 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
                  >
                    {t("profilePage.deleteCancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {editOpen && <ProfileEdit onClose={() => setEditOpen(false)} />}
    </main>
  );
}

export default Profile;
