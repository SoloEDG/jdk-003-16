import type { Region } from "@/shared/domain";
/**
 * 一次胜利的预算规则。数值集中放在这里，奖励页、商店与牌组页共享同一套口径。
 * 冻结的是“这次胜利能买什么”的价格表，而不是把预览过程拆成多次领取。
 */
export const rewardRules = {
  /** 每点好感为本次胜利额外带来的预算。 */
  favorBonus: 2,
  /** 卡牌预算价格：普通 / 稀有。 */
  cardPriceCommon: 12,
  cardPriceRare: 18,
  /** 每个补给包的价格与回复。 */
  supplyPrice: 10,
  supplyHeal: 4,
  maxSupplies: 2,
  /** 剩余预算兑换凭证的比例：1 预算 = 1 面值。 */
  voucherPer: 1,
  /** 奖励页单次治疗的上限，避免一次点满把预算全吃掉。 */
  maxHeal: 12,
} as const;

export function rewardBudget(gold: number, favor: number) {
  return Math.max(0, gold + rewardRules.favorBonus * favor);
}

/** 林地治疗更便宜；熔铁边境的补给包有商人折扣；深渊照价。 */
export function healUnitPrice(region: Region) {
  switch (region) {
    case "forest":
      return 2;
    case "forge":
      return 3;
    default:
      return 3;
  }
}

export function supplyPriceFor(region: Region) {
  return region === "forge" ? 8 : rewardRules.supplyPrice;
}

export function supplyHealFor(_region: Region) {
  return rewardRules.supplyHeal;
}
