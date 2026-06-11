export const AuthSubjects = {
  register: "auth.register",
  login: "auth.login",
  logout: "auth.logout",
  refresh: "auth.refresh",
  verify: "auth.verify",
  health: "auth.health"
} as const;

export const UserSubjects = {
  findProfile: "users.findProfile",
  updateProfile: "users.updateProfile",
  findFriends: "users.findFriends",
  findPendingRequests: "users.findPendingRequests",
  sendFriendRequest: "users.sendFriendRequest",
  respondFriendRequest: "users.respondFriendRequest",
  removeFriend: "users.removeFriend",
  blockUser: "users.blockUser",
  unblockUser: "users.unblockUser",
  health: "users.health",
  findMe: "users.findMe",
  deleteAccount: "users.deleteAccount",
  searchUsers: "users.searchUsers"
} as const;

export const GameSubjects = {
  create: "game.create",
  join: "game.join",
  leave: "game.leave",
  playerMoved: "game.player.moved",
  playerEliminated: "game.player.eliminated",
  diamondCollected: "game.diamond.collected",
  roundEnded: "game.round.ended",
  stateSnapshot: "game.state.snapshot",
  health: "game.health"
} as const;

export const MatchmakingSubjects = {
  joinQueue: "matchmaking.joinQueue",
  leaveQueue: "matchmaking.leaveQueue",
  matchFound: "matchmaking.match.found",
  health: "matchmaking.health"
} as const;

export const ChatSubjects = {
  sendMessage: "chat.message.send",
  messageSent: "chat.message.sent",
  findHistory: "chat.history.find",
  health: "chat.health"
} as const;

export const NotificationSubjects = {
  send: "notifications.send",
  deliver: "notifications.deliver",
  health: "notification.health"
} as const;

export const RealtimeSubjects = {
  health: "realtime.health"
} as const;

export const ClientSocketEvents = {
  lobbyJoin: "lobby:join",
  lobbyLeave: "lobby:leave",
  gameJoin: "game:join",
  gameLeave: "game:leave",
  playerInput: "game:player-input"
} as const;

export const ServerSocketEvents = {
  gatewayReady: "gateway:ready",
  gatewayError: "gateway:error",
  lobbyJoined: "lobby:joined",
  lobbyLeft: "lobby:left",
  matchFound: "matchmaking:match-found",
  gameJoined: "game:joined",
  gameLeft: "game:left",
  notification: "notification",
  gameState: "game:state"
} as const;

export type AuthSubject = (typeof AuthSubjects)[keyof typeof AuthSubjects];
export type UserSubject = (typeof UserSubjects)[keyof typeof UserSubjects];
export type GameSubject = (typeof GameSubjects)[keyof typeof GameSubjects];
export type MatchmakingSubject = (typeof MatchmakingSubjects)[keyof typeof MatchmakingSubjects];
export type ChatSubject = (typeof ChatSubjects)[keyof typeof ChatSubjects];
export type NotificationSubject = (typeof NotificationSubjects)[keyof typeof NotificationSubjects];
export type RealtimeSubject = (typeof RealtimeSubjects)[keyof typeof RealtimeSubjects];
export type ClientSocketEvent = (typeof ClientSocketEvents)[keyof typeof ClientSocketEvents];
export type ServerSocketEvent = (typeof ServerSocketEvents)[keyof typeof ServerSocketEvents];
