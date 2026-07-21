import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Friendship, UserProfile } from "@whoshuman/shared-types";
import { apiError } from "../shared/api/errors";
import {
  blockUser,
  getFriends,
  getPendingRequests,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  unblockUser
} from "../shared/api/friends";
import { searchUsers } from "../shared/api/users";
import { useAuthStore } from "../shared/authStore";
import CornerBrackets from "../shared/CornerBrackets";
import { useHologramSound } from "../shared/useHologramSound";

type FriendsTab = "contacts" | "requests" | "search";

const ghostButton =
  "border border-neon-cyan/40 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10 active:translate-y-px";
const dangerButton =
  "border border-sun-orange/60 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-sun-orange transition hover:bg-sun-orange/10 active:translate-y-px";

function initialsOf(username: string): string {
  return username.slice(0, 2).toUpperCase() || "--";
}

// Fila-expediente del registro: avatar de iniciales, identidad y acciones a la derecha.
function RegistryRow({
  username,
  meta,
  onOpen,
  children
}: {
  username: string;
  meta: string;
  onOpen?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border border-neon-cyan/20 bg-white/3 px-4 py-3 transition hover:border-neon-cyan/40 hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="flex min-w-0 items-center gap-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-neon-cyan/40 bg-neon-cyan/10 font-display text-sm font-black text-neon-cyan">
          {initialsOf(username)}
        </span>
        <span className="min-w-0">
          <span className="font-display block truncate text-sm font-bold text-text-main">
            {username}
          </span>
          <span className="block text-xs text-text-muted/80">{meta}</span>
        </span>
      </button>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// Estado vacío como aviso de sistema: qué no hay y qué hacer a continuación.
function EmptyState({ text }: { text: string }) {
  return (
    <p className="border border-neon-cyan/15 bg-black/20 px-4 py-8 text-center font-display text-xs font-bold uppercase tracking-[0.25em] text-text-muted/70">
      // {text}
    </p>
  );
}

// Ficha pública de otra unidad (overlay). Acciones según contexto.
function UnitDossier({
  profile,
  onClose,
  onError
}: {
  profile: UserProfile;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [requestSent, setRequestSent] = useState(false);

  const since = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "long"
  }).format(new Date(profile.createdAt));

  const send = useMutation({
    mutationFn: () => sendFriendRequest(profile.id),
    onSuccess: () => setRequestSent(true),
    onError: (err) => onError(apiError(err, t("friends.sendRequest")))
  });
  const block = useMutation({
    mutationFn: () => blockUser(profile.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      onClose();
    },
    onError: (err) => onError(apiError(err, t("friends.block")))
  });
  const unblock = useMutation({
    mutationFn: () => unblockUser(profile.id),
    onError: (err) => onError(apiError(err, t("friends.unblock")))
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-bg/80 p-4">
      <div className="animate-unfold-down relative w-full max-w-md origin-top border border-neon-cyan/50 bg-surface shadow-[0_0_48px_rgba(36,245,255,0.18)]">
        <CornerBrackets color="var(--color-neon-magenta)" />
        <div className="flex items-center justify-between border-b border-neon-cyan/30 bg-neon-cyan/8 px-6 py-3">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("friends.dossier")}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="font-display text-xs font-bold text-neon-cyan hover:brightness-125"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          <div className="mb-5 flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center border-2 border-neon-cyan/40 bg-neon-cyan/10 font-display text-2xl font-black text-neon-cyan [text-shadow:0_0_14px_rgba(36,245,255,0.6)]">
              {initialsOf(profile.username)}
            </span>
            <div className="min-w-0">
              <p className="font-display truncate text-xl font-black uppercase text-text-main">
                {profile.username}
              </p>
              <p className="text-xs text-text-muted">
                {t("friends.since")} {since}
              </p>
            </div>
          </div>

          <p className="mb-6 whitespace-pre-wrap text-sm text-text-main">{profile.bio || "—"}</p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={requestSent || send.isPending}
              onClick={() => send.mutate()}
              className={
                requestSent
                  ? "border border-success bg-success/10 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-success"
                  : ghostButton
              }
            >
              {requestSent ? t("friends.requestSent") : t("friends.sendRequest")}
            </button>
            <button type="button" onClick={() => block.mutate()} className={dangerButton}>
              {t("friends.block")}
            </button>
            <button type="button" onClick={() => unblock.mutate()} className={ghostButton}>
              {t("friends.unblock")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Friends() {
  const { t, i18n } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FriendsTab>("contacts");
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<UserProfile | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  useHologramSound();

  // Debounce: la query de red usa el texto "asentado" 300ms después de teclear,
  // así no disparamos una petición por pulsación.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const friendsQuery = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
    enabled: isAuthenticated
  });
  const requestsQuery = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getPendingRequests,
    enabled: isAuthenticated
  });
  // Búsqueda paginada: useInfiniteQuery encadena páginas del backend. Cada página
  // trae meta.totalPages; getNextPageParam devuelve la siguiente o undefined (fin).
  const searchQuery = useInfiniteQuery({
    queryKey: ["userSearch", debouncedQuery],
    queryFn: ({ pageParam }) => searchUsers(debouncedQuery, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: isAuthenticated && debouncedQuery.length >= 2
  });
  const searchResults = searchQuery.data?.pages.flatMap((page) => page.data) ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["friends"] });
    void queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
  };

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondFriendRequest(id, accept),
    onSuccess: invalidate,
    onError: (err) => setError(apiError(err, t("friends.accept")))
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFriend(id),
    onSuccess: invalidate,
    onError: (err) => setError(apiError(err, t("friends.remove")))
  });
  const send = useMutation({
    mutationFn: (userId: string) => sendFriendRequest(userId),
    onSuccess: (_data, userId) => setSentIds((prev) => new Set(prev).add(userId)),
    onError: (err) => setError(apiError(err, t("friends.sendRequest")))
  });

  if (!isAuthenticated) {
    if (!localStorage.getItem("refreshToken")) {
      return <Navigate to="/login" />;
    }
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <p className="font-display animate-pulse text-sm font-bold uppercase tracking-[0.3em] text-neon-cyan">
          // {t("profilePage.identifying")}
        </p>
      </main>
    );
  }

  const sinceOf = (friendship: Friendship) =>
    `${t("friends.since")} ${new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
      month: "short"
    }).format(new Date(friendship.createdAt))}`;

  const pendingCount = requestsQuery.data?.length ?? 0;

  const tabs: { id: FriendsTab; label: string; badge?: number }[] = [
    { id: "contacts", label: t("friends.tabContacts") },
    { id: "requests", label: t("friends.tabRequests"), badge: pendingCount },
    { id: "search", label: t("friends.tabSearch") }
  ];

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[32rem] w-[32rem] bg-neon-cyan/8 blur-3xl" />
      </div>

      <div className="animate-unfold-down relative w-full max-w-3xl origin-top border border-neon-cyan/50 bg-surface shadow-[0_0_48px_rgba(36,245,255,0.18),inset_0_0_48px_rgba(36,245,255,0.03)]">
        {/* Cabecera terminal */}
        <div className="border-b border-neon-cyan/30 bg-neon-cyan/8 px-6 py-3 sm:px-10">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("friends.eyebrow")}
          </p>
        </div>
        <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-neon-magenta" />
        <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-neon-magenta" />
        <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-neon-magenta" />
        <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-neon-magenta" />

        <div className="px-6 py-8 sm:px-10">
          <h1 className="font-display mb-1 text-[clamp(1.5rem,5vw,2.25rem)] font-black uppercase leading-none text-text-main [text-shadow:0_0_18px_rgba(255,43,214,0.45),0_0_36px_rgba(36,245,255,0.24)]">
            {t("friends.title")}
          </h1>
          <p className="mb-7 text-sm text-text-muted">{t("friends.subtitle")}</p>

          {/* Selector de canal: pestañas terminal. La activa lleva relleno cian. */}
          <div className="mb-6 flex border border-neon-cyan/30">
            {tabs.map(({ id, label, badge }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? "flex-1 bg-neon-cyan/15 px-2 py-2.5 font-display text-xs font-black uppercase tracking-wider text-neon-cyan [text-shadow:0_0_12px_rgba(36,245,255,0.6)]"
                    : "flex-1 px-2 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-text-muted transition hover:text-neon-cyan"
                }
              >
                {label}
                {badge ? <span className="ml-1.5 text-neon-magenta">[{badge}]</span> : null}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 flex items-center justify-between border border-error bg-error/10 px-4 py-3">
              <p className="text-sm font-bold text-error">// {error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="font-display text-xs font-bold text-error hover:brightness-125"
              >
                ✕
              </button>
            </div>
          )}

          {/* CONTACTOS */}
          {tab === "contacts" && (
            <div className="flex flex-col gap-2">
              {friendsQuery.data?.length === 0 && <EmptyState text={t("friends.emptyContacts")} />}
              {friendsQuery.data?.map((friendship) => (
                <RegistryRow
                  key={friendship.id}
                  username={friendship.user.username}
                  meta={sinceOf(friendship)}
                  onOpen={() =>
                    setDossier({
                      id: friendship.user.id,
                      username: friendship.user.username,
                      avatar: friendship.user.avatar,
                      bio: friendship.user.bio,
                      createdAt: friendship.user.createdAt
                    })
                  }
                >
                  <span className="inline-flex border border-current bg-success/10 px-3 py-1 text-xs font-bold text-success">
                    {t("friends.statusLinked")}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove.mutate(friendship.id)}
                    className={dangerButton}
                  >
                    {t("friends.remove")}
                  </button>
                </RegistryRow>
              ))}
            </div>
          )}

          {/* SOLICITUDES */}
          {tab === "requests" && (
            <div className="flex flex-col gap-2">
              {requestsQuery.data?.length === 0 && <EmptyState text={t("friends.emptyRequests")} />}
              {requestsQuery.data?.map((request) => (
                <RegistryRow
                  key={request.id}
                  username={request.user.username}
                  meta={sinceOf(request)}
                >
                  <button
                    type="button"
                    onClick={() => respond.mutate({ id: request.id, accept: true })}
                    className="border-2 border-neon-magenta bg-neon-magenta px-3 py-1.5 font-display text-xs font-black uppercase tracking-wider text-bg transition hover:brightness-110 active:translate-y-px"
                  >
                    {t("friends.accept")}
                  </button>
                  <button
                    type="button"
                    onClick={() => respond.mutate({ id: request.id, accept: false })}
                    className={dangerButton}
                  >
                    {t("friends.decline")}
                  </button>
                </RegistryRow>
              ))}
            </div>
          )}

          {/* BÚSQUEDA */}
          {tab === "search" && (
            <div className="flex flex-col gap-4">
              <div>
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("friends.searchPlaceholder")}
                  className="box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 font-display uppercase tracking-wider text-text-main outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
                />
                <p className="mt-1 text-xs text-text-muted/70">{t("friends.searchHint")}</p>
              </div>

              <div className="flex flex-col gap-2">
                {debouncedQuery.length >= 2 && searchResults.length === 0 && (
                  <EmptyState text={t("friends.emptySearch")} />
                )}
                {searchResults.map((profile) => (
                  <RegistryRow
                    key={profile.id}
                    username={profile.username}
                    meta={profile.bio || "—"}
                    onOpen={() => setDossier(profile)}
                  >
                    <button
                      type="button"
                      disabled={sentIds.has(profile.id) || send.isPending}
                      onClick={() => send.mutate(profile.id)}
                      className={
                        sentIds.has(profile.id)
                          ? "border border-success bg-success/10 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-success"
                          : ghostButton
                      }
                    >
                      {sentIds.has(profile.id)
                        ? t("friends.requestSent")
                        : t("friends.sendRequest")}
                    </button>
                  </RegistryRow>
                ))}
                {searchQuery.hasNextPage && (
                  <button
                    type="button"
                    disabled={searchQuery.isFetchingNextPage}
                    onClick={() => void searchQuery.fetchNextPage()}
                    className="border border-neon-cyan/40 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10 disabled:opacity-50"
                  >
                    {searchQuery.isFetchingNextPage
                      ? t("friends.loadingMore")
                      : t("friends.loadMore")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {dossier && (
        <UnitDossier profile={dossier} onClose={() => setDossier(null)} onError={setError} />
      )}
    </main>
  );
}

export default Friends;
