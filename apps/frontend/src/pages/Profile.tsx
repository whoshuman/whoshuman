import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, PencilLine } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiError } from "../shared/api/errors";
import { deleteMe, getCombatStats, getMe } from "../shared/api/users";
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
  const { data: serverUser } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: isAuthenticated,
    initialData: storedUser ?? undefined
  });
  const {
    data: combatStats,
    isLoading: statsLoading,
    isError: statsError
  } = useQuery({
    queryKey: ["me", "combat-stats"],
    queryFn: getCombatStats,
    enabled: isAuthenticated,
    refetchOnMount: "always"
  });

  // Sincroniza el store cuando el servidor trae datos más recientes (p. ej. el
  // perfil se editó desde otro dispositivo). updatedAt evita re-persistir en bucle.
  useEffect(() => {
    if (
      serverUser &&
      (!storedUser || new Date(serverUser.updatedAt) > new Date(storedUser.updatedAt))
    ) {
      updateUser(serverUser);
    }
  }, [serverUser, storedUser, updateUser]);

  const user = storedUser ?? serverUser;

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

  if (editOpen) {
    return <ProfileEdit onClose={() => setEditOpen(false)} />;
  }

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
  const matchDateFormatter = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

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
        <div className="flex items-center justify-between gap-4 border-b border-neon-cyan/30 bg-neon-cyan/8 px-6 py-3 sm:px-10">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("profilePage.eyebrow")}
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/lobby" })}
            className="flex shrink-0 items-center gap-2 border border-neon-cyan/40 px-3 py-2 font-display text-[0.65rem] font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={2} />
            <span className="hidden sm:inline">{t("profilePage.backToLobby")}</span>
            <span className="sm:hidden">{t("common.backShort")}</span>
          </button>
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

          {/* Registro de combate persistido al finalizar cada partida. */}
          <div className="mb-8 border border-neon-cyan/25 bg-black/20 px-5 py-4">
            <p className="font-display mb-3 text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan/80">
              // {t("profilePage.statsTitle")}
            </p>
            {statsLoading && (
              <p className="font-display animate-pulse text-xs font-bold uppercase tracking-wider text-neon-cyan/70">
                {t("profilePage.statsLoading")}
              </p>
            )}
            {!statsLoading && statsError && (
              <p className="font-display text-xs font-bold uppercase tracking-wider text-error">
                {t("profilePage.statsError")}
              </p>
            )}
            {!statsLoading && !statsError && combatStats?.totalGames === 0 && (
              <>
                <span className="inline-flex border border-current bg-white/5 px-3 py-1 text-sm font-bold text-text-muted/60">
                  {t("profilePage.statsEmpty")}
                </span>
                <p className="mt-3 text-xs text-text-muted/70">{t("profilePage.statsPending")}</p>
              </>
            )}
            {!statsLoading && !statsError && combatStats && combatStats.totalGames > 0 && (
              <>
                <div className="mb-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-sm font-black uppercase text-neon-cyan">
                      {t("profilePage.statsLevel", {
                        level: combatStats.progression.level
                      })}
                    </p>
                    <p className="font-display text-xs font-bold uppercase text-neon-magenta">
                      {combatStats.globalRank
                        ? t("profilePage.statsGlobalRank", { rank: combatStats.globalRank })
                        : t("profilePage.statsUnranked")}
                    </p>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={combatStats.progression.progressPercent}
                    className="h-2 overflow-hidden bg-neon-cyan/15"
                  >
                    <div
                      className="h-full bg-neon-cyan shadow-[0_0_12px_rgba(36,245,255,0.8)]"
                      style={{ width: `${combatStats.progression.progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs text-text-muted">
                    {t("profilePage.statsXp", {
                      current: combatStats.progression.currentLevelExperience,
                      required: combatStats.progression.experienceForNextLevel
                    })}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-px border border-neon-cyan/20 bg-neon-cyan/20 sm:grid-cols-3">
                  {[
                    ["statsGames", combatStats.totalGames],
                    ["statsWins", combatStats.wins],
                    ["statsLosses", combatStats.losses],
                    ["statsTotalPoints", combatStats.totalPoints],
                    ["statsBestScore", combatStats.bestScore],
                    ["statsAverage", combatStats.averagePoints]
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 bg-surface px-3 py-3">
                      <dt className="font-display text-[0.6rem] font-bold uppercase leading-tight tracking-wider text-text-muted">
                        {t(`profilePage.${label}`)}
                      </dt>
                      <dd className="font-display mt-1 truncate text-xl font-black text-neon-cyan">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-5">
                  <p className="font-display mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neon-magenta">
                    {t("profilePage.statsRecent")}
                  </p>
                  <div className="border-y border-neon-cyan/20">
                    {combatStats.recentMatches.map((match) => (
                      <div
                        key={match.gameId}
                        className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-neon-cyan/15 px-1 py-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto]"
                      >
                        <div className="min-w-0">
                          <p className="font-display truncate text-xs font-bold uppercase text-text-main">
                            {t("profilePage.statsMatch", {
                              date: matchDateFormatter.format(new Date(match.playedAt))
                            })}
                          </p>
                          {match.opponents.length > 0 && (
                            <p className="mt-1 truncate text-[0.65rem] text-text-muted/70">
                              {t("profilePage.statsOpponents", {
                                names: match.opponents.join(", ")
                              })}
                            </p>
                          )}
                        </div>
                        <p className="hidden text-xs font-bold text-text-muted sm:block">
                          {t("profilePage.statsPlacement", {
                            placement: match.placement,
                            count: match.playerCount
                          })}
                        </p>
                        <p className="font-display text-sm font-black text-neon-magenta">
                          {match.points > 0 ? "+" : ""}
                          {match.points} {t("profilePage.statsPointsShort")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="font-display mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neon-magenta">
                      {t("profilePage.statsAchievements")}
                    </p>
                    <div className="space-y-px bg-neon-cyan/15">
                      {combatStats.achievements.map((achievement) => (
                        <div
                          key={achievement.id}
                          className="flex items-center justify-between gap-3 bg-surface px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p
                              className={`font-display truncate text-xs font-bold uppercase ${
                                achievement.unlocked ? "text-neon-cyan" : "text-text-muted"
                              }`}
                            >
                              {t(`profilePage.achievement.${achievement.id}`)}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-bold text-text-muted">
                            {Math.min(achievement.current, achievement.target)}/{achievement.target}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="font-display mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neon-magenta">
                      {t("profilePage.statsLeaderboard")}
                    </p>
                    <ol className="space-y-px bg-neon-cyan/15">
                      {combatStats.leaderboard.map((entry) => (
                        <li
                          key={entry.userId}
                          className={`grid grid-cols-[2rem_1fr_auto] items-center gap-2 px-3 py-2 text-xs ${
                            entry.userId === user.id ? "bg-neon-cyan/10" : "bg-surface"
                          }`}
                        >
                          <span className="font-display font-black text-neon-cyan">
                            #{entry.rank}
                          </span>
                          <span className="truncate font-bold text-text-main">
                            {entry.username}
                          </span>
                          <span className="font-display font-black text-neon-magenta">
                            {entry.totalPoints} {t("profilePage.statsPointsShort")}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Acción principal */}
          <div className="border-t border-neon-cyan/20 pt-6">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="group flex w-full items-center justify-center gap-3 border-2 border-neon-magenta bg-neon-magenta px-6 py-4 font-display text-sm font-black uppercase tracking-[0.2em] text-bg shadow-[0_0_24px_rgba(255,43,214,0.35)] transition hover:brightness-110 hover:shadow-[0_0_38px_rgba(255,43,214,0.55)] active:translate-y-px"
            >
              <PencilLine
                aria-hidden="true"
                size={21}
                strokeWidth={2.2}
                className="transition-transform group-hover:-rotate-6"
              />
              {t("profilePage.edit")}
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
    </main>
  );
}

export default Profile;
