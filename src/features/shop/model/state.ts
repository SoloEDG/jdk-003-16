import { reactive, readonly } from "vue";
import type { JourneyContext, Purchase } from "@/shared/domain";
import { makeStock, type StockItem } from "../lib/stock";
import { priceFor } from "../lib/pricing";
const state = reactive({
  context: null as JourneyContext | null,
  stock: [] as StockItem[],
  purchases: [] as Purchase[],
  open: false,
  /** 待确认的购买项。选中只做价格核对，不扣任何资源。 */
  pendingId: null as string | null,
});
export const shopState = readonly(state);
export function openShop(c: JourneyContext) {
  if (state.context?.nodeId !== c.nodeId) {
    state.context = c;
    state.stock = makeStock(c);
  }
  state.open = true;
  state.pendingId = null;
}
export function selectItem(id: string) {
  if (!state.open) return;
  const item = state.stock.find((s) => s.id === id);
  state.pendingId = item && !item.sold ? id : null;
}
/** 取消交易：什么都没扣，凭证与金币余额原样保留。 */
export function cancelItem() {
  state.pendingId = null;
}
export function itemPrice(id: string) {
  const item = state.stock.find((s) => s.id === id);
  return item && state.context
    ? priceFor(item.basePrice, state.context.influence)
    : Infinity;
}
/**
 * 购买报价：价格是完整、不可分割的。调用方必须先拿这个总价去核对
 * 凭证余额与金币余额，两者加起来不够就整笔拒绝，绝不先扣一部分。
 */
export function preparePurchase(id: string): Purchase | null {
  const item = state.stock.find((s) => s.id === id);
  if (!state.open || !item || item.sold) return null;
  const price = itemPrice(id);
  if (!Number.isFinite(price)) return null;
  return { id: item.id, card: item.card, price, voucherPaid: 0, goldPaid: 0 };
}
export function completePurchase(p: Purchase) {
  const item = state.stock.find((s) => s.id === p.id);
  if (!item || item.sold) return false;
  if (p.voucherPaid + p.goldPaid !== p.price) return false;
  item.sold = true;
  state.purchases.push(p);
  state.pendingId = null;
  return true;
}
export function closeShop() {
  state.open = false;
  state.pendingId = null;
}
export function exportShop() {
  return JSON.parse(JSON.stringify(state));
}
export function restoreShop(d: ReturnType<typeof exportShop>) {
  Object.assign(state, d);
  state.pendingId = null;
}
export function resetShop() {
  state.context = null;
  state.stock = [];
  state.purchases = [];
  state.open = false;
  state.pendingId = null;
}
