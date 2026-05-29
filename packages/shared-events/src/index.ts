export const AuthSubjects = {
  register: "auth.register",
  login: "auth.login",
  refresh: "auth.refresh",
  verify: "auth.verify",
  profile: "auth.profile",
  health: "auth.health"
} as const;

export const UserSubjects = {
  findProfile: "users.findProfile",
  updateProfile: "users.updateProfile",
  findFriends: "users.findFriends",
  health: "users.health"
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

export type AuthSubject = (typeof AuthSubjects)[keyof typeof AuthSubjects];
export type UserSubject = (typeof UserSubjects)[keyof typeof UserSubjects];
export type GameSubject = (typeof GameSubjects)[keyof typeof GameSubjects];
export type MatchmakingSubject = (typeof MatchmakingSubjects)[keyof typeof MatchmakingSubjects];
export type ChatSubject = (typeof ChatSubjects)[keyof typeof ChatSubjects];
