import { reactive, readonly } from "vue";
import type {
  BattleResult,
  MerchantRef,
  VictoryBudget,
  Voucher,
} from "@/shared/domain";
import {
  commitDraft,
  expireVoucher,
  makeVoucher,
  makeVictoryBudget,
  normalizeDraft,
  quote,
  supplyHeal,
} from "../lib/settlement";

interface Draft {
  card: string | null;
  heal: number;
  supplies: number;
}
interface RewardState {
  offer: VictoryBudget | null;
  history: string[];
  draft: Draft;
  vouchers: Voucher[];
  expiryNotice: string;
}
const state = reactive<RewardState>({
  offer: null,
  history: [],
  draft: { card: null, heal: 0, supplies: 0 },
  vouchers: [],
  expiryNotice: "",
});
export const rewardState = readonly(state);

function resetDraft() {
  state.draft = { card: null, heal: 0, supplies: 0 };
}

/**
 * 打开胜利结算，返回是否**新冻结**了一份预算。
 * 同一场胜利的预算一经冻结就不能追加：已提交过只回放结果；
 * 刷新页面后重新打开的是同一份冻结预算，不会重新生成卡池或重置预算。
 */
export function openReward(
  result: BattleResult,
  merchant: MerchantRef | null,
) {
  if (!result.won) return false;
  if (state.history.includes(result.id)) return false;
  if (state.offer?.source === result.id) return false;
  state.offer = makeVictoryBudget(result, merchant);
  state.draft = { card: null, heal: 0, supplies: 0 };
  return true;
}

export function setDraftCard(key: string | null) {
  if (state.offer?.claimed) return;
  state.draft.card = key;
}

export function setDraftHeal(value: number) {
  if (state.offer?.claimed) return;
  state.draft.heal = value;
}

export function setDraftSupplies(value: number) {
  if (state.offer?.claimed) return;
  state.draft.supplies = value;
}

export function previewQuote() {
  if (!state.offer) return null;
  return quote(state.offer, normalizeDraft(state.offer, state.draft));
}

export interface RewardGrant {
  card: string | null;
  heal: number;
  supplies: number;
  voucher: Voucher | null;
  spent: number;
  voucherValue: number;
  source: string;
}

/**
 * 提交组合。这是唯一会生成卡牌 / 治疗 / 补给 / 凭证的入口。
 * 金币在胜利时已计入预算，不再二次发放，避免重复结算。
 */
export function claimReward(): RewardGrant | null {
  const offer = state.offer;
  if (!offer || offer.claimed) return null;
  const committed = commitDraft(offer, state.draft);
  if (!committed) return null;
  offer.claimed = true;
  offer.commit = committed.commit;
  state.history.push(offer.source);
  resetDraft();
  const voucher = makeVoucher(offer, committed.commit.voucherValue);
  if (voucher) {
    state.vouchers.push(voucher);
    state.expiryNotice = "";
  }
  // 治疗与补给在同一次提交里一起到账，生命按“治疗 + 补给回复”结算。
  return {
    card: committed.commit.card,
    heal:
      committed.commit.heal +
      supplyHeal(offer.region, committed.commit.supplies),
    supplies: committed.commit.supplies,
    voucher,
    spent: committed.commit.spent,
    voucherValue: committed.commit.voucherValue,
    source: offer.source,
  };
}

/** 商店消费：只动用绑定该商人的有效凭证，余额不足的部分交给金币补齐。 */
export function spendVouchers(
  merchantNodeId: string,
  amount: number,
): { paid: number; spends: { voucherId: string; amount: number }[] } {
  let left = Math.max(0, Math.floor(amount));
  const spends: { voucherId: string; amount: number }[] = [];
  for (const v of state.vouchers) {
    if (left <= 0) break;
    if (v.status !== "active" || v.nodeId !== merchantNodeId) continue;
    const take = Math.min(v.remaining, left);
    if (take <= 0) continue;
    v.remaining -= take;
    left -= take;
    spends.push({ voucherId: v.id, amount: take });
    if (v.remaining === 0) v.status = "spent";
  }
  return { paid: Math.max(0, Math.floor(amount)) - left, spends };
}

export function refundVouchers(spends: { voucherId: string; amount: number }[]) {
  for (const s of spends) {
    const v = state.vouchers.find((x) => x.id === s.voucherId);
    if (!v || v.status === "expired") continue;
    v.remaining += s.amount;
    v.status = "active";
  }
}

export function voucherBalance(nodeId: string) {
  return state.vouchers
    .filter((v) => v.status === "active" && v.nodeId === nodeId)
    .reduce((n, v) => n + v.remaining, 0);
}

/**
 * 商店结算后调用：绑定到已经离开路线的商人的凭证会到期，
 * 明确销毁剩余面值并留下说明，而不是静默丢失。
 */
export function expireDepartedVouchers(usableMerchantIds: string[]) {
  const expired: Voucher[] = [];
  for (const v of state.vouchers) {
    if (v.status !== "active") continue;
    if (usableMerchantIds.includes(v.nodeId)) continue;
    expired.push(expireVoucher(v));
  }
  state.vouchers = state.vouchers.map(
    (v) => expired.find((e) => e.id === v.id) ?? v,
  );
  if (expired.length) {
    const destroyed = expired.reduce((n, v) => n + v.destroyed, 0);
    state.expiryNotice = `${expired.length} 张凭证到期，销毁 ${destroyed} 面值（${expired
      .map((v) => v.merchant.title)
      .join("、")} 的商人已经离开了路线）。`;
  }
  return expired;
}

export function exportReward() {
  return JSON.parse(
    JSON.stringify({
      offer: state.offer,
      history: state.history,
      draft: state.draft,
      vouchers: state.vouchers,
      expiryNotice: state.expiryNotice,
    }),
  );
}

export function restoreReward(d: ReturnType<typeof exportReward>) {
  state.offer = d.offer ?? null;
  state.history = d.history ?? [];
  state.vouchers = Array.isArray(d.vouchers) ? d.vouchers : [];
  state.expiryNotice = d.expiryNotice ?? "";
  // 未提交的组合草稿也要随存档恢复：刷新不能悄悄改掉玩家排好的预算。
  if (state.offer && !state.offer.claimed && d.draft)
    state.draft = normalizeDraft(state.offer, {
      card: d.draft.card ?? null,
      heal: d.draft.heal ?? 0,
      supplies: d.draft.supplies ?? 0,
    });
  else resetDraft();
}

export function resetReward() {
  state.offer = null;
  state.history = [];
  state.vouchers = [];
  state.expiryNotice = "";
  resetDraft();
}
