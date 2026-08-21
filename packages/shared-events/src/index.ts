export const AuthSubjects = {
  register: "auth.register",
  login: "auth.login",
  oauthStart: "auth.oauth.start",
  oauthCallback: "auth.oauth.callback",
  oauthComplete: "auth.oauth.complete",
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
  findBlockedUsers: "users.findBlockedUsers",
  sendFriendRequest: "users.sendFriendRequest",
  respondFriendRequest: "users.respondFriendRequest",
  removeFriend: "users.removeFriend",
  blockUser: "users.blockUser",
  unblockUser: "users.unblockUser",
  health: "users.health",
  findMe: "users.findMe",
  combatStats: "users.combatStats",
  deleteAccount: "users.deleteAccount",
  searchUsers: "users.searchUsers"
} as const;

export const GameSubjects = {
  join: "game.join",
  disconnected: "game.disconnected",
  leave: "game.leave",
  aim: "game.aim",
  shoot: "game.shoot",
  playerMoved: "game.player.moved",
  stateSnapshot: "game.state.snapshot",
  health: "game.health"
} as const;

export const MatchmakingSubjects = {
  joinQueue: "matchmaking.joinQueue",
  leaveQueue: "matchmaking.leaveQueue",
  setReady: "matchmaking.setReady",
  matchFound: "matchmaking.match.found",
  lobbyUpdated: "matchmaking.lobby.updated",
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
  list: "notifications.list",
  unreadCount: "notifications.unreadCount",
  markRead: "notifications.markRead",
  markAllRead: "notifications.markAllRead",
  health: "notification.health"
} as const;

export const RealtimeSubjects = {
  health: "realtime.health"
} as const;

export const ClientSocketEvents = {
  lobbyJoin: "lobby:join",
  lobbyLeave: "lobby:leave",
  lobbyReady: "lobby:ready",
  gameJoin: "game:join",
  gameLeave: "game:leave",
  gameAim: "game:aim",
  gameShoot: "game:shoot",
  playerInput: "game:player-input",
  presenceList: "presence:list",
  chatSend: "chat:send",
  chatHistory: "chat:history"
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
  gameState: "game:state",
  lobbyState: "lobby:state",
  presenceState: "presence:state",
  presenceChanged: "presence:changed",
  chatMessage: "chat:message"
} as const;
