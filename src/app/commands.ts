import {
  enterRoute,
  resolveRoute,
  resetRoute,
  upcomingShop,
  reachableShopIds,
} from "@/features/route";
import {
  battleState,
  beginBattle,
  playCard,
  endTurn,
  resetBattle,
} from "@/features/battle";
import {
  deckState,
  deckCards,
  addCard,
  earnGold,
  spendGold,
  setHp,
  heal,
  upgradeCard,
  removeCard,
  openCamp,
  useCamp,
  resetDeck,
} from "@/features/deck";
import {
  openReward,
  claimReward,
  spendVouchers,
  refundVouchers,
  voucherBalance,
  expireDepartedVouchers,
  rewardState,
  setDraftCard,
  setDraftHeal,
  setDraftSupplies,
  resetReward,
} from "@/features/reward";
import {
  openShop,
  preparePurchase,
  completePurchase,
  closeShop,
  shopState,
  cancelItem,
  resetShop,
} from "@/features/shop";
import {
  session,
  switchTab,
  setContext,
  notify,
  finishRun,
  resetSession,
} from "./session";
import { save, clearSave } from "./persistence";
function persist() {
  if (!save()) notify("本地保存失败，请保留当前页面。");
}
/**
 * 每次路线推进后重新核对凭证的可用范围：绑定商店已经不在剩余路线上的凭证，
 * 在此刻到期并明确记账。返回给玩家的说明，没有到期则为空。
 */
function settleVoucherExpiry(): string {
  const expired = expireDepartedVouchers(reachableShopIds());
  if (!expired.length) return "";
  return ` · ${expired.length} 张凭证到期，销毁 ${expired.reduce(
    (n, v) => n + v.destroyed,
    0,
  )} 面值`;
}
export function navigate(id: string) {
  if (session.ended) return;
  const c = enterRoute(id);
  if (!c) return;
  setContext(c);
  if (c.kind === "shop") {
    openShop(c);
    switchTab("shop");
  } else if (c.kind === "camp") {
    openCamp();
    switchTab("deck");
  } else {
    beginBattle(c, deckCards(), deckState.hero.hp, deckState.hero.maxHp);
    switchTab("battle");
  }
  const expiry = settleVoucherExpiry();
  notify(
    `进入 ${c.nodeId} · 威胁 ${c.influence.heat} / 好感 ${c.influence.favor}${expiry}`,
  );
  persist();
}
export function play(id: string) {
  playCard(id);
  persist();
}
export function turn() {
  endTurn();
  persist();
}
export function settle() {
  const r = battleState.result;
  if (!r) return;
  if (!r.won) {
    setHp(r.hp);
    finishRun();
    notify("这次旅途已经结束。重新启程可保留你的经验。");
    persist();
    return;
  }
  // 同一场胜利只结算一次：已经提交过的胜利不会再次改写生命或生成权益。
  if (rewardState.history.includes(r.id)) {
    switchTab("reward");
    notify("这场胜利已经结算，预算不可重复领取。");
    persist();
    return;
  }
  // 预算已冻结但尚未提交：回到奖励页继续组合，不重新冻结或追加预算。
  if (rewardState.offer?.source === r.id) {
    switchTab("reward");
    notify("本次胜利的预算已冻结，仍等待提交。");
    persist();
    return;
  }
  setHp(r.hp);
  const merchant = upcomingShop(r.nodeId);
  if (openReward(JSON.parse(JSON.stringify(r)), merchant)) {
    switchTab("reward");
    notify("胜利！冻结本次预算，组合卡牌、治疗、补给与凭证。");
  } else {
    switchTab("reward");
    notify("这场胜利已经结算，预算不可重复领取。");
  }
  persist();
}
export function draftCard(key: string | null) {
  setDraftCard(key);
  persist();
}
export function draftHeal(value: number) {
  setDraftHeal(value);
  persist();
}
export function draftSupplies(value: number) {
  setDraftSupplies(value);
  persist();
}
export function claim() {
  const grant = claimReward();
  if (!grant) {
    notify("组合无效：请检查预算或先提交一次组合。");
    return;
  }
  if (grant.card) addCard(grant.card);
  if (grant.heal) heal(grant.heal);
  resolveRoute();
  const parts = [
    grant.card ? "卡牌" : null,
    grant.heal ? `${grant.heal} 点治疗` : null,
    grant.voucher ? `${grant.voucher.faceValue} 面值凭证` : null,
  ].filter(Boolean);
  const summary = parts.length ? parts.join("、") : "未分配预算";
  if (session.context?.kind === "boss") {
    finishRun();
    notify("裂隙已被封存。你把余烬带回了黎明。");
  } else if (grant.voucher)
    notify(`${summary} 已一起到账。凭证绑定 ${grant.voucher.merchant.title}。`);
  else notify(`${summary} 已一起到账。剩余预算没有可绑定的商店，未生成凭证。`);
  switchTab("route");
  persist();
}
export function buy(id: string) {
  // 只接受已经核对过价格的待确认项，避免绕过确认直接扣款。
  if (shopState.pendingId !== id) {
    notify("请先核对价格并确认支付。");
    return;
  }
  const p = preparePurchase(id);
  if (!p) {
    cancelItem();
    notify("无法购买：库存已售罄。");
    return;
  }
  if (!shopState.context) return;
  const nodeId = shopState.context.nodeId;
  const voucherUsed = Math.min(p.price, voucherBalance(nodeId));
  const goldNeeded = p.price - voucherUsed;
  if (goldNeeded > deckState.hero.gold) {
    cancelItem();
    notify("无法购买：凭证与金币加起来不足以支付完整价格，交易未发生。");
    return;
  }
  // 先核对完整价格，再一并扣除凭证与金币；任何一步失败都整笔回滚。
  const spent = spendVouchers(nodeId, voucherUsed);
  if (spent.paid !== voucherUsed) {
    refundVouchers(spent.spends);
    cancelItem();
    notify("无法购买：凭证余额在结算中发生变化，交易未发生。");
    return;
  }
  if (goldNeeded > 0 && !spendGold(goldNeeded)) {
    refundVouchers(spent.spends);
    cancelItem();
    notify("无法购买：金币不足，交易未发生。");
    return;
  }
  const purchase = { ...p, voucherPaid: spent.paid, goldPaid: goldNeeded };
  if (!completePurchase(purchase)) {
    if (goldNeeded > 0) earnGold(goldNeeded);
    refundVouchers(spent.spends);
    cancelItem();
    notify("无法购买：库存已变化，交易未发生。");
    return;
  }
  addCard(p.card);
  notify(
    spent.paid
      ? `交易完成：凭证抵扣 ${spent.paid}，金币支付 ${goldNeeded}。`
      : "交易完成，卡牌已收入牌组。",
  );
  persist();
}
export function leaveShop() {
  closeShop();
  resolveRoute();
  const expiry = settleVoucherExpiry();
  switchTab("route");
  notify(`你离开商店，继续上路${expiry}。`);
  persist();
}
export function camp(action: "rest" | "upgrade") {
  if (
    !session.context ||
    session.context.kind !== "camp" ||
    !useCamp(action, session.context.influence.heat)
  )
    return;
  resolveRoute();
  notify("篝火逐渐熄灭，你准备好继续上路。");
  persist();
}
export function upgrade(id: string) {
  if (battleState.phase === "playing") return;
  notify(upgradeCard(id) ? "卡牌强化完成。" : "无法强化：金币不足或已经强化。");
  persist();
}
export function remove(id: string) {
  if (battleState.phase === "playing") return;
  notify(
    removeCard(id)
      ? "已移除卡牌。"
      : "无法移除：至少保留五张牌，且需要足够金币。",
  );
  persist();
}
export function restart() {
  resetRoute();
  resetBattle();
  resetDeck();
  resetReward();
  resetShop();
  resetSession();
  clearSave();
  persist();
}
