<script setup lang="ts">
import { computed } from "vue";
import { shopState, itemPrice, selectItem, cancelItem } from "../model/state";
import { quoteMessage } from "../lib/pricing";
import { rewardState } from "@/features/reward/model/state";
import { cards } from "@/shared/cards";
const props = defineProps<{ gold: number }>();
defineEmits<{ buy: [id: string]; leave: [] }>();
function voucherFor(nodeId: string) {
  return rewardState.vouchers
    .filter((v) => v.status === "active" && v.nodeId === nodeId)
    .reduce((n, v) => n + v.remaining, 0);
}
function voucherUse(nodeId: string, price: number) {
  return Math.min(price, voucherFor(nodeId));
}
function goldUse(nodeId: string, price: number) {
  return price - voucherUse(nodeId, price);
}
const pending = computed(() => {
  const id = shopState.pendingId;
  return id ? shopState.stock.find((s) => s.id === id) ?? null : null;
});
const pendingPrice = computed(() =>
  pending.value ? itemPrice(pending.value.id) : 0,
);
const pendingVoucher = computed(() =>
  pending.value ? voucherUse(shopState.context!.nodeId, pendingPrice.value) : 0,
);
const pendingGold = computed(() => pendingPrice.value - pendingVoucher.value);
const pendingAffordable = computed(() => pendingGold.value <= props.gold);
/**
 * 离开这家商店后，绑定它的凭证就再也用不到了，剩余面值会被销毁。
 * 在确认离开前把这个数字算清楚告诉玩家。
 */
const leavingLoss = computed(() => {
  const nodeId = shopState.context?.nodeId;
  if (!nodeId) return 0;
  return rewardState.vouchers
    .filter((v) => v.status === "active" && v.nodeId === nodeId)
    .reduce((n, v) => n + v.remaining, 0);
});
</script>
<template>
  <section class="panel">
    <div class="section-top">
      <span class="eyebrow">04 / THE TRADER</span><span>旅途补给</span>
    </div>
    <h2>路上的旧相识</h2>
    <template v-if="shopState.open"
      ><p class="muted">
        {{
          quoteMessage(
            shopState.context!.influence.favor,
            shopState.context!.influence.scarcity,
          )
        }}
        <br />先核对完整卡价，再确认支付：凭证抵扣不足部分才用金币，取消交易不会扣除任何余额。
      </p>
      <div v-if="voucherFor(shopState.context!.nodeId)" class="notice">
        ✦ 此处可用凭证 {{ voucherFor(shopState.context!.nodeId) }} 面值
      </div>
      <div class="stock">
        <div
          v-for="item in shopState.stock"
          :key="item.id"
          :class="{ pending: shopState.pendingId === item.id }"
        >
          <div>
            <b>{{ cards[item.card]?.name }}</b
            ><small>{{ cards[item.card]?.text }}</small>
          </div>
          <button
            :disabled="
              item.sold ||
                shopState.pendingId === item.id ||
                goldUse(shopState.context!.nodeId, itemPrice(item.id)) > gold
            "
            :data-stock="item.id"
            @click="selectItem(item.id)"
          >
            <template v-if="item.sold">已售出</template>
            <template v-else>
              {{ itemPrice(item.id) }} 金 · 购买<span
                v-if="voucherUse(shopState.context!.nodeId, itemPrice(item.id))"
                class="pay-split"
              >
                核对：凭证 −{{ voucherUse(shopState.context!.nodeId, itemPrice(item.id)) }}
                / 金币 {{ goldUse(shopState.context!.nodeId, itemPrice(item.id)) }}</span
              >
            </template>
          </button>
        </div>
      </div>
      <div v-if="pending" class="notice">
        <b>核对完整价格：{{ pendingPrice }}</b>
        → 凭证 {{ pendingVoucher }} + 金币 {{ pendingGold }}
        <span v-if="!pendingAffordable" class="warn-text">
          · 金币不足，无法支付
        </span>
        <div class="toolbar">
          <button
            data-action="confirm-buy"
            :disabled="!pendingAffordable"
            @click="$emit('buy', pending!.id)"
          >
            确认支付（一并扣除）
          </button>
          <button data-action="cancel-buy" @click="cancelItem()">
            取消交易
          </button>
        </div>
      </div>
      <p v-if="leavingLoss" class="notice warn" data-leaving-loss>
        离开后 {{ leavingLoss }} 面值凭证将到期销毁；剩余路线不再经过该商人。
      </p>
      <button data-action="leave-shop" @click="$emit('leave')">
        收好行囊，继续前进 →
      </button></template
    >
    <div v-else class="empty-mini">
      寻找路线上的天平标记。安路的好感让金币走得更远。
    </div>
  </section>
</template>
