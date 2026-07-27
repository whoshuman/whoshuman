import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Friendship, UserProfile } from "@whoshuman/shared-types";
import { apiError } from "../shared/api/errors";
import {
  blockUser,
  getBlockedUsers,
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

type FriendsTab = "contacts" | "requests" | "search" | "blocked";
type DossierState = { profile: UserProfile; allowRequest: boolean };
type FriendActionKind = "send" | "remove" | "decline" | "block" | "unblock";
type PendingFriendAction = { kind: FriendActionKind; id: string; username: string };

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

function LoadingState({ text }: { text: string }) {
  return (
    <p className="animate-pulse border border-neon-cyan/20 bg-neon-cyan/5 px-4 py-8 text-center font-display text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan">
      // {text}
    </p>
  );
}

function ConfirmationDialog({
  kind,
  username,
  pending,
  onConfirm,
  onCancel
}: {
  kind: FriendActionKind;
  username: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isDanger = kind === "remove" || kind === "decline" || kind === "block";
  const actionKey: Record<FriendActionKind, string> = {
    send: "friends.sendRequest",
    remove: "friends.remove",
    decline: "friends.decline",
    block: "friends.block",
    unblock: "friends.unblock"
  };
  const titleKey: Record<FriendActionKind, string> = {
    send: "friends.confirmSendTitle",
    remove: "friends.confirmRemoveTitle",
    decline: "friends.confirmDeclineTitle",
    block: "friends.confirmBlockTitle",
    unblock: "friends.confirmUnblockTitle"
  };
  const messageKey: Record<FriendActionKind, string> = {
    send: "friends.confirmSend",
    remove: "friends.confirmRemove",
    decline: "friends.confirmDecline",
    block: "friends.confirmBlock",
    unblock: "friends.confirmUnblock"
  };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, pending]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={pending ? undefined : onCancel}
        className="absolute inset-0 cursor-default bg-bg/90 backdrop-blur-sm"
      />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="friend-confirmation-title"
        aria-describedby="friend-confirmation-message"
        className={`animate-unfold-down relative w-full max-w-md origin-top border bg-surface shadow-[0_0_48px_rgba(0,0,0,0.6)] ${
          isDanger ? "border-sun-orange/70" : "border-neon-cyan/70"
        }`}
      >
        <CornerBrackets color={isDanger ? "var(--color-sun-orange)" : "var(--color-neon-cyan)"} />
        <div
          className={`border-b px-6 py-3 ${
            isDanger ? "border-sun-orange/30 bg-sun-orange/8" : "border-neon-cyan/30 bg-neon-cyan/8"
          }`}
        >
          <p
            className={`font-display text-xs font-bold uppercase tracking-[0.3em] ${
              isDanger ? "text-sun-orange" : "text-neon-cyan"
            }`}
          >
            // {t("friends.confirmationRequired")}
          </p>
        </div>

        <div className="px-6 py-7">
          <h2
            id="friend-confirmation-title"
            className="font-display text-xl font-black uppercase text-text-main"
          >
            {t(titleKey[kind])}
          </h2>
          <p
            id="friend-confirmation-message"
            className="mt-3 text-sm leading-relaxed text-text-muted"
          >
            {t(messageKey[kind], { username })}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={onCancel}
              className="border border-neon-cyan/50 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10 disabled:opacity-50"
            >
              {t("friends.cancel")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className={`border-2 px-5 py-2.5 font-display text-xs font-black uppercase tracking-wider text-bg transition hover:brightness-110 disabled:opacity-50 ${
                isDanger ? "border-sun-orange bg-sun-orange" : "border-neon-cyan bg-neon-cyan"
              }`}
            >
              {t(actionKey[kind])}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// Ficha pública de otra unidad (overlay). Acciones según contexto.
function UnitDossier({
  profile,
  allowRequest,
  onClose,
  onError
}: {
  profile: UserProfile;
  allowRequest: boolean;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [requestSent, setRequestSent] = useState(false);
  const [pendingAction, setPendingAction] = useState<"send" | "block" | null>(null);

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
      void queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
      onClose();
    },
    onError: (err) => onError(apiError(err, t("friends.block")))
  });
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-bg/80 p-4">
      <div className="animate-unfold-down relative w-full max-w-md origin-top border border-neon-cyan/50 bg-surface shadow-[0_0_48px_rgba(36,245,255,0.18)]">
        <CornerBrackets color="var(--color-neon-magenta)" />
        <div className="flex items-center justify-between border-b border-neon-cyan/30 bg-neon-cyan/8 px-6 py-3">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("friends.dossier")}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("friends.closeDossier")}
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
            {allowRequest && (
              <button
                type="button"
                disabled={requestSent || send.isPending}
                onClick={() => setPendingAction("send")}
                className={
                  requestSent
                    ? "border border-success bg-success/10 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-success"
                    : ghostButton
                }
              >
                {requestSent ? t("friends.requestSent") : t("friends.sendRequest")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPendingAction("block")}
              className={dangerButton}
            >
              {t("friends.block")}
            </button>
          </div>
        </div>
      </div>

      {pendingAction && (
        <ConfirmationDialog
          kind={pendingAction}
          username={profile.username}
          pending={send.isPending || block.isPending}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            if (pendingAction === "send") send.mutate();
            else block.mutate();
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
}

function Friends() {
  const { t, i18n } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FriendsTab>("contacts");
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<DossierState | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<PendingFriendAction | null>(null);
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
  const blockedQuery = useQuery({
    queryKey: ["blockedUsers"],
    queryFn: getBlockedUsers,
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
    void queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
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
  const block = useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onSuccess: invalidate,
    onError: (err) => setError(apiError(err, t("friends.block")))
  });
  const unblock = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: invalidate,
    onError: (err) => setError(apiError(err, t("friends.unblock")))
  });

  const sinceOf = (friendship: Friendship) =>
    `${t("friends.since")} ${new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
      month: "short"
    }).format(new Date(friendship.createdAt))}`;

  const pendingCount = requestsQuery.data?.length ?? 0;

  const tabs: { id: FriendsTab; label: string; badge?: number }[] = [
    { id: "contacts", label: t("friends.tabContacts") },
    { id: "requests", label: t("friends.tabRequests"), badge: pendingCount },
    { id: "search", label: t("friends.tabSearch") },
    { id: "blocked", label: t("friends.tabBlocked") }
  ];

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    switch (pendingAction.kind) {
      case "send":
        send.mutate(pendingAction.id);
        break;
      case "remove":
        remove.mutate(pendingAction.id);
        break;
      case "decline":
        respond.mutate({ id: pendingAction.id, accept: false });
        break;
      case "block":
        block.mutate(pendingAction.id);
        break;
      case "unblock":
        unblock.mutate(pendingAction.id);
        break;
    }
    setPendingAction(null);
  };

  return (
    <main className="relative flex min-h-[calc(100vh-11.5rem)] flex-col items-center px-4 py-10 sm:min-h-[calc(100vh-8.5rem)]">
      <div className="animate-unfold-down relative w-full max-w-3xl origin-top border border-neon-cyan/50 bg-surface shadow-[0_0_48px_rgba(36,245,255,0.18),inset_0_0_48px_rgba(36,245,255,0.03)]">
        {/* Cabecera terminal */}
        <div className="flex items-center justify-between gap-4 border-b border-neon-cyan/30 bg-neon-cyan/8 px-6 py-3 sm:px-10">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("friends.eyebrow")}
          </p>
          <Link
            to="/lobby"
            className="flex shrink-0 items-center gap-2 border border-neon-cyan/40 px-3 py-2 font-display text-[0.65rem] font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
          >
            <ArrowLeft aria-hidden="true" size={15} strokeWidth={2} />
            <span className="hidden sm:inline">{t("friends.backToLobby")}</span>
            <span className="sm:hidden">{t("common.backShort")}</span>
          </Link>
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
          <div className="mb-6 grid grid-cols-2 border border-neon-cyan/30 sm:grid-cols-4">
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
              {friendsQuery.isPending && <LoadingState text={t("friends.loading")} />}
              {friendsQuery.isError && (
                <EmptyState text={apiError(friendsQuery.error, t("friends.loadError"))} />
              )}
              {friendsQuery.data?.length === 0 && <EmptyState text={t("friends.emptyContacts")} />}
              {friendsQuery.data?.map((friendship) => (
                <RegistryRow
                  key={friendship.id}
                  username={friendship.user.username}
                  meta={sinceOf(friendship)}
                  onOpen={() =>
                    setDossier({
                      profile: friendship.user,
                      allowRequest: false
                    })
                  }
                >
                  <span className="inline-flex border border-current bg-success/10 px-3 py-1 text-xs font-bold text-success">
                    {t("friends.statusLinked")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingAction({
                        kind: "remove",
                        id: friendship.id,
                        username: friendship.user.username
                      })
                    }
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
              {requestsQuery.isPending && <LoadingState text={t("friends.loading")} />}
              {requestsQuery.isError && (
                <EmptyState text={apiError(requestsQuery.error, t("friends.loadError"))} />
              )}
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
                    onClick={() =>
                      setPendingAction({
                        kind: "decline",
                        id: request.id,
                        username: request.user.username
                      })
                    }
                    className={dangerButton}
                  >
                    {t("friends.decline")}
                  </button>
                  <button
                    type="button"
                    disabled={block.isPending}
                    onClick={() =>
                      setPendingAction({
                        kind: "block",
                        id: request.user.id,
                        username: request.user.username
                      })
                    }
                    className={dangerButton}
                  >
                    {t("friends.block")}
                  </button>
                </RegistryRow>
              ))}
            </div>
          )}

          {/* BÚSQUEDA */}
          {tab === "search" && (
            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="friend-search"
                  className="mb-2 block font-display text-xs font-bold uppercase tracking-wider text-text-muted"
                >
                  {t("friends.searchLabel")}
                </label>
                <input
                  id="friend-search"
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("friends.searchPlaceholder")}
                  className="box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 font-display uppercase tracking-wider text-text-main outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
                />
                <p className="mt-1 text-xs text-text-muted/70">{t("friends.searchHint")}</p>
              </div>

              <div className="flex flex-col gap-2">
                {searchQuery.isFetching && searchResults.length === 0 && (
                  <LoadingState text={t("friends.loading")} />
                )}
                {searchQuery.isError && (
                  <EmptyState text={apiError(searchQuery.error, t("friends.loadError"))} />
                )}
                {debouncedQuery.length >= 2 &&
                  !searchQuery.isFetching &&
                  !searchQuery.isError &&
                  searchResults.length === 0 && <EmptyState text={t("friends.emptySearch")} />}
                {searchResults.map((profile) => (
                  <RegistryRow
                    key={profile.id}
                    username={profile.username}
                    meta={profile.bio || "—"}
                    onOpen={() => setDossier({ profile, allowRequest: true })}
                  >
                    <button
                      type="button"
                      disabled={sentIds.has(profile.id) || send.isPending}
                      onClick={() =>
                        setPendingAction({
                          kind: "send",
                          id: profile.id,
                          username: profile.username
                        })
                      }
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

          {/* BLOQUEADOS */}
          {tab === "blocked" && (
            <div className="flex flex-col gap-2">
              {blockedQuery.isPending && <LoadingState text={t("friends.loading")} />}
              {blockedQuery.isError && (
                <EmptyState text={apiError(blockedQuery.error, t("friends.loadError"))} />
              )}
              {blockedQuery.data?.length === 0 && <EmptyState text={t("friends.emptyBlocked")} />}
              {blockedQuery.data?.map((friendship) => (
                <RegistryRow
                  key={friendship.id}
                  username={friendship.user.username}
                  meta={sinceOf(friendship)}
                >
                  <span className="inline-flex border border-current bg-sun-orange/10 px-3 py-1 text-xs font-bold text-sun-orange">
                    {t("friends.statusBlocked")}
                  </span>
                  <button
                    type="button"
                    disabled={unblock.isPending}
                    onClick={() =>
                      setPendingAction({
                        kind: "unblock",
                        id: friendship.user.id,
                        username: friendship.user.username
                      })
                    }
                    className={ghostButton}
                  >
                    {t("friends.unblock")}
                  </button>
                </RegistryRow>
              ))}
            </div>
          )}
        </div>
      </div>

      {dossier && (
        <UnitDossier
          profile={dossier.profile}
          allowRequest={dossier.allowRequest}
          onClose={() => setDossier(null)}
          onError={setError}
        />
      )}

      {pendingAction && (
        <ConfirmationDialog
          kind={pendingAction.kind}
          username={pendingAction.username}
          pending={
            respond.isPending ||
            remove.isPending ||
            send.isPending ||
            block.isPending ||
            unblock.isPending
          }
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmPendingAction}
        />
      )}
    </main>
  );
}

export default Friends;
