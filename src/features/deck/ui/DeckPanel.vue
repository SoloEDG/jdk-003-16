<script setup lang="ts">
import { computed } from "vue";
import { deckState, selectCard } from "../model/state";
import { cards } from "@/shared/cards";
import { upgradeCost, removalCost } from "../lib/costs";
import { rewardState } from "@/features/reward/model/state";
import { reachableShopIds } from "@/features/route/model/state";
import type { Voucher } from "@/shared/domain";
import { regionNames } from "@/shared/domain";
defineProps<{ camp: boolean; locked: boolean }>();
const emit = defineEmits<{
  upgrade: [id: string];
  remove: [id: string];
  camp: [action: "rest" | "upgrade"];
}>();
const activeVoucherTotal = computed(() =>
  rewardState.vouchers
    .filter((v) => v.status === "active")
    .reduce((n, v) => n + v.remaining, 0),
);
/**
 * 到期范围：绑定商人仍在剩余可走路线（或正站在其中）时凭证继续有效；
 * 一旦路线不可能再回到那家商店，凭证就会在下次推进时销毁剩余面值。
 */
function expiryScope(v: Voucher) {
  return reachableShopIds().includes(v.nodeId)
    ? `仍可抵达 · 在${v.merchant.title}处可用`
    : "剩余路线已不再经过该商人，下次推进时销毁";
}
</script>
<template>
  <section class="panel">
    <div class="section-top">
      <span class="eyebrow">05 / YOUR ARSENAL</span
      ><span>{{ deckState.cards.length }} 张</span>
    </div>
    <h2>行囊中的可能</h2>
    <p class="muted">
      相同卡牌拥有独立身份。强化只影响选中的这一张，战斗中的牌组锁定。
    </p>
    <div v-if="camp" class="camp">
      <h3>篝火 · {{ deckState.campUsed ? "已经休整" : "选择一次休整" }}</h3>
      <button :disabled="deckState.campUsed" @click="emit('camp', 'rest')">
        休息 · 回复生命</button
      ><button
        :disabled="deckState.campUsed || !deckState.selected"
        @click="emit('camp', 'upgrade')"
      >
        免费强化选中牌
      </button>
    </div>
    <div v-if="rewardState.vouchers.length" class="voucher-list">
      <h3>
        战利凭证
        <span class="muted" v-if="activeVoucherTotal"
          >· 共 {{ activeVoucherTotal }} 可用面值</span
        >
      </h3>
      <p class="muted">
        凭证由某一次胜利冻结的剩余预算生成，绑定指定的地区商人；到期时未消费的余额会被销毁并明确记账。
      </p>
      <div
        v-for="v in rewardState.vouchers"
        :key="v.id"
        :class="['voucher', v.status]"
        :data-voucher="v.id"
      >
        <div>
          <b>{{ v.merchant.title }}</b>
          <small>{{ regionNames[v.merchant.region] }} · 深度 {{ v.merchant.depth }}</small>
        </div>
        <div>
          <span>余 {{ v.remaining }} / {{ v.faceValue }} 面值</span>
          <small v-if="v.status === 'active'">{{ expiryScope(v) }}</small>
          <small v-else-if="v.status === 'spent'">已全额使用</small>
          <small v-else>已到期 · 销毁 {{ v.destroyed }} 面值</small>
        </div>
      </div>
    </div>
    <div class="deck-list">
      <button
        v-for="c in deckState.cards"
        :key="c.id"
        :data-card-id="c.id"
        :class="{ selected: deckState.selected === c.id }"
        @click="selectCard(c.id)"
      >
        <span>{{ cards[c.key]?.name }}{{ c.upgraded ? " +" : "" }}</span
        ><small>{{ cards[c.key]?.text }}</small
        ><em>{{ c.id.slice(-6) }}</em>
      </button>
    </div>
    <div class="toolbar">
      <button
        :disabled="locked || !deckState.selected"
        @click="emit('upgrade', deckState.selected)"
      >
        强化 · {{ upgradeCost(false, deckState.hero.scars) }} 金</button
      ><button
        :disabled="locked || !deckState.selected || deckState.cards.length <= 5"
        @click="emit('remove', deckState.selected)"
      >
        移除 · {{ removalCost(deckState.removals) }} 金
      </button>
    </div>
  </section>
</template>
