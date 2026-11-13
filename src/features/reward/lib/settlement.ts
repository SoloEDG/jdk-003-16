import type {
  BattleResult,
  MerchantRef,
  RewardCardOffer,
  RewardCommit,
  VictoryBudget,
  Voucher,
} from "@/shared/domain";
import { cards } from "@/shared/cards";
import { shuffle, hash } from "@/shared/random";
import {
  healUnitPrice,
  rewardBudget,
  rewardRules,
  supplyHealFor,
  supplyPriceFor,
} from "./config";

const rewardPoolByRegion = {
  forest: ["venom", "shelter", "guard", "focus"],
  forge: ["strike", "guard", "burst", "fury"],
  abyss: ["venom", "burst", "focus", "fury"],
} as const;

/** 指定地区 / 节点的商店卡池，商店与“凭证绑定”的展示使用同一口径。 */
export function shopCardPool(region: BattleResult["context"]["region"]) {
  return [...rewardPoolByRegion[region]];
}

export function rewardPool(context: BattleResult["context"]): RewardCardOffer[] {
  const rare =
    context.influence.heat >= 2 ||
    context.kind === "elite" ||
    context.kind === "boss";
  const pool = shopCardPool(context.region);
  const offers = shuffle(
    rare
      ? pool
      : [
          ...pool.filter((k) => !["burst", "fury"].includes(k)),
          "strike" as const,
        ],
    hash(context.nodeId),
  ).slice(0, 3);
  return offers.map((key) => ({
    key,
    cost:
      cards[key]!.rarity === "rare"
        ? rewardRules.cardPriceRare
        : rewardRules.cardPriceCommon,
  }));
}

/** 只读视图：奖励状态是 readonly 的，但规则只需要读取这些字段。 */
export interface BudgetView {
  readonly budget: number;
  readonly region: VictoryBudget["region"];
  readonly claimed: boolean;
  readonly merchant: MerchantRef | null;
  readonly cardOffers: readonly RewardCardOffer[];
}

export interface RewardQuote {
  card: { key: string; cost: number } | null;
  heal: number;
  healCost: number;
  supplies: number;
  supplyCost: number;
  spent: number;
  remaining: number;
  voucherValue: number;
  voucherUnavailable: boolean;
  valid: boolean;
  reason?: string;
}

/** 奖励页的预览只是草稿。这里只计算，不触碰牌组、生命或金币。 */
export function quote(
  budget: BudgetView,
  draft: { card: string | null; heal: number; supplies: number },
): RewardQuote {
  const cardOffer = draft.card
    ? (budget.cardOffers.find((c) => c.key === draft.card) ?? null)
    : null;
  const cardCost = cardOffer?.cost ?? 0;
  const healWanted = Math.max(
    0,
    Math.min(rewardRules.maxHeal, Math.floor(draft.heal || 0)),
  );
  const healRate = healUnitPrice(budget.region);
  const healCost = healWanted * healRate;
  const supplyCap = rewardRules.maxSupplies;
  const supplies = Math.max(0, Math.min(supplyCap, Math.floor(draft.supplies || 0)));
  const supplyCost = supplies * supplyPriceFor(budget.region);
  const spent = cardCost + healCost + supplyCost;
  const voucherValue = Math.floor(
    Math.max(0, budget.budget - spent) / rewardRules.voucherPer,
  );
  const remaining = Math.max(0, budget.budget - spent);
  const invalidCard = !!draft.card && !cardOffer;
  const invalidHeal =
    healWanted !== (draft.heal || 0) ||
    (draft.heal || 0) > rewardRules.maxHeal;
  const invalidSupplies =
    supplies !== (draft.supplies || 0) || draft.supplies > supplyCap;
  const valid =
    !budget.claimed &&
    !invalidCard &&
    !invalidHeal &&
    !invalidSupplies &&
    spent <= budget.budget;
  // 没有可绑定的商人时，剩余预算无法变成凭证；照常可以提交，但必须明确告知会损失。
  const voucherUnavailable = voucherValue > 0 && !budget.merchant;
  return {
    card: cardOffer,
    heal: healWanted,
    healCost,
    supplies,
    supplyCost,
    spent,
    remaining,
    voucherValue,
    voucherUnavailable,
    valid,
    reason: valid
      ? undefined
      : invalidCard
        ? "这张牌不在本次胜利的预算内。"
        : spent > budget.budget
          ? "超出本次预算。把剩余预算兑换成凭证，或减少治疗 / 补给。"
          : "组合参数无效。",
  };
}

export function cardAvailable(budget: BudgetView, key: string) {
  return budget.cardOffers.some((c) => c.key === key);
}

export function normalizeDraft(
  budget: BudgetView,
  draft: { card: string | null; heal: number; supplies: number },
) {
  const card = draft.card && cardAvailable(budget, draft.card) ? draft.card : null;
  return {
    card,
    heal: Math.max(
      0,
      Math.min(rewardRules.maxHeal, Math.floor(draft.heal || 0)),
    ),
    supplies: Math.max(
      0,
      Math.min(rewardRules.maxSupplies, Math.floor(draft.supplies || 0)),
    ),
  };
}

/**
 * 把草稿固化成不可追加的提交结果。
 * 提交后同一胜利的预算被标记 claimed，只能读到 commit，不能再次生成权益。
 */
export function commitDraft(
  budget: VictoryBudget,
  draft: { card: string | null; heal: number; supplies: number },
): { commit: RewardCommit; quote: RewardQuote } | null {
  const normalized = normalizeDraft(budget, draft);
  const q = quote(budget, normalized);
  if (!q.valid) return null;
  return {
    commit: {
      card: q.card?.key ?? null,
      heal: q.heal,
      supplies: q.supplies,
      spent: q.spent,
      voucherValue: q.voucherValue,
    },
    quote: q,
  };
}

export function makeVictoryBudget(
  result: BattleResult,
  merchant: MerchantRef | null,
): VictoryBudget {
  return {
    id: `reward-${result.id}`,
    source: result.id,
    nodeId: result.nodeId,
    region: result.context.region,
    budget: rewardBudget(result.gold, result.context.influence.favor),
    cardOffers: rewardPool(result.context),
    merchant,
    claimed: false,
    commit: null,
  };
}

export function makeVoucher(
  budget: VictoryBudget,
  value: number,
): Voucher | null {
  if (!budget.merchant || value <= 0) return null;
  return {
    id: `voucher-${budget.source}-${budget.merchant.nodeId}`,
    rewardId: budget.id,
    source: budget.source,
    nodeId: budget.merchant.nodeId,
    merchant: { ...budget.merchant },
    faceValue: value,
    remaining: value,
    status: "active",
    destroyed: 0,
  };
}

export function supplyHeal(region: VictoryBudget["region"], supplies: number) {
  return supplyHealFor(region) * supplies;
}

/** 凭证到期：绑定商店已经离开路线，尚未消费的余额明确销毁。 */
export function expireVoucher(v: Voucher): Voucher {
  if (v.status !== "active") return v;
  return {
    ...v,
    destroyed: v.remaining,
    remaining: 0,
    status: "expired",
  };
}
