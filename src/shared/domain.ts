export type Region = "forest" | "forge" | "abyss";
export type NodeKind = "battle" | "elite" | "shop" | "camp" | "boss";
export interface Influence {
  heat: number;
  favor: number;
  scarcity: number;
}
export interface RouteNode {
  id: string;
  region: Region;
  depth: number;
  lane: number;
  kind: NodeKind;
  title: string;
  influence: Influence;
  next: string[];
}
export interface CardInstance {
  id: string;
  key: string;
  upgraded: boolean;
}
export interface CardSpec {
  key: string;
  name: string;
  cost: number;
  kind: "attack" | "skill" | "power";
  text: string;
  rarity: "common" | "rare";
  effects: Effect[];
}
export type Effect = {
  type: "damage" | "block" | "draw" | "poison" | "strength" | "heal" | "energy";
  amount: number;
  target: "hero" | "enemy";
};
export interface Actor {
  hp: number;
  maxHp: number;
  block: number;
  strength: number;
  poison: number;
  thorns: number;
}
export interface JourneyContext {
  nodeId: string;
  region: Region;
  depth: number;
  kind: NodeKind;
  influence: Influence;
}
export interface BattleResult {
  id: string;
  nodeId: string;
  won: boolean;
  hp: number;
  gold: number;
  context: JourneyContext;
}
export interface MerchantRef {
  nodeId: string;
  region: Region;
  depth: number;
  title: string;
}
export interface RewardCardOffer {
  key: string;
  cost: number;
}
export interface RewardCommit {
  card: string | null;
  heal: number;
  supplies: number;
  spent: number;
  voucherValue: number;
}
/**
 * 一次胜利的预算。预算在胜利结算时冻结，之后只能分配，不能追加。
 * 奖励页的组合只是草稿，不会改动牌组或生命，提交时才一起到账。
 */
export interface VictoryBudget {
  id: string;
  source: string;
  nodeId: string;
  region: Region;
  budget: number;
  cardOffers: RewardCardOffer[];
  merchant: MerchantRef | null;
  claimed: boolean;
  commit: RewardCommit | null;
}
export interface Voucher {
  id: string;
  rewardId: string;
  source: string;
  nodeId: string;
  merchant: MerchantRef;
  faceValue: number;
  remaining: number;
  status: "active" | "spent" | "expired";
  destroyed: number;
}
export interface VoucherSpend {
  voucherId: string;
  amount: number;
}
export interface Purchase {
  id: string;
  card: string;
  price: number;
  voucherPaid: number;
  goldPaid: number;
}
export interface ExpeditionSummary {
  hp: number;
  maxHp: number;
  gold: number;
  scars: number;
}
export const regionNames: Record<Region, string> = {
  forest: "苔光林地",
  forge: "熔铁边境",
  abyss: "无声深渊",
};
