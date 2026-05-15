import type { PlayerStatus } from "@dont-trust-that-card/shared";

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  active: "进行中",
  pending_win: "出完待判",
  won: "已出完",
  left: "已离场"
};

export function getPlayerStatusLabel(status: PlayerStatus): string {
  return PLAYER_STATUS_LABELS[status];
}

export function getChallengeStampText(success: boolean): string {
  return success ? "质疑成功" : "质疑失败";
}
