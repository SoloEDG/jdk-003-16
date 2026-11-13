<script setup lang="ts">
import { computed } from "vue";
import { rewardState } from "../model/state";
import { healUnitPrice, rewardRules, supplyPriceFor } from "../lib/config";
import { normalizeDraft, quote, supplyHeal } from "../lib/settlement";
import { cards } from "@/shared/cards";
const props = defineProps<{ hp: number; maxHp: number; deckSize: number }>();
const emit = defineEmits<{
  claim: [];
  card: [key: string | null];
  heal: [value: number];
  supplies: [value: number];
}>();
const active = computed(() => rewardState.offer && !rewardState.offer.claimed);
const draft = computed(() =>
  rewardState.offer
    ? normalizeDraft(rewardState.offer, rewardState.draft)
    : { card: null, heal: 0, supplies: 0 },
);
const priced = computed(() => {
  const offer = rewardState.offer;
  return offer ? quote(offer, draft.value) : null;
});
const healRate = computed(() =>
  rewardState.offer ? healUnitPrice(rewardState.offer.region) : 0,
);
const supplyPrice = computed(() =>
  rewardState.offer ? supplyPriceFor(rewardState.offer.region) : 0,
);
const supplyHp = computed(() =>
  rewardState.offer
    ? supplyHeal(rewardState.offer.region, draft.value.supplies)
    : 0,
);
const previewHp = computed(() =>
  Math.min(props.maxHp, props.hp + (priced.value?.heal ?? 0) + supplyHp.value),
);
const previewDeck = computed(() => props.deckSize + (draft.value.card ? 1 : 0));
</script>
<template>
  <section class="panel">
    <div class="section-top">
      <span class="eyebrow">03 / THE SPOILS</span><span>预算组合</span>
    </div>
    <h2>把胜利带进下一场</h2>
    <p class="muted">
      每次胜利冻结一份不可追加的预算：在一张新牌、治疗和补给之间自由组合，
      剩余预算可兑换成下一家商店可用的战利凭证。调整只是预览，提交后才一起到账。
    </p>
    <div v-if="active && rewardState.offer && priced">
      <div class="notice">
        ✦ 本次预算 {{ rewardState.offer.budget }} · 已分配
        {{ priced.spent }} · 余 {{ priced.remaining }} 预算
        <small v-if="priced.voucherValue">
          → 可兑 {{ priced.voucherValue }} 面值凭证
        </small>
      </div>
      <div class="reward-options">
        <button
          v-for="offerCard in rewardState.offer.cardOffers"
          :key="offerCard.key"
          :class="{ selected: draft.card === offerCard.key }"
          :data-reward-card="offerCard.key"
          @click="emit('card', draft.card === offerCard.key ? null : offerCard.key)"
        >
          <b>{{ cards[offerCard.key]?.name }}</b
          ><small>{{ cards[offerCard.key]?.text }}</small
          ><em>{{ cards[offerCard.key]?.rarity }} · {{ offerCard.cost }} 预算</em>
        </button>
      </div>
      <div class="reward-budget">
        <div class="budget-row">
          <span>治疗</span>
          <button
            :disabled="draft.heal <= 0"
            data-action="heal-minus"
            @click="emit('heal', draft.heal - 1)"
          >
            −
          </button>
          <b>{{ draft.heal }} 点</b>
          <button
            :disabled="draft.heal >= rewardRules.maxHeal"
            data-action="heal-plus"
            @click="emit('heal', draft.heal + 1)"
          >
            +
          </button>
          <small>{{ healRate }} 预算 / 点 · 合计 {{ priced.healCost }}</small>
        </div>
        <div class="budget-row">
          <span>补给包</span>
          <button
            :disabled="draft.supplies <= 0"
            data-action="supply-minus"
            @click="emit('supplies', draft.supplies - 1)"
          >
            −
          </button>
          <b>{{ draft.supplies }} 个</b>
          <button
            :disabled="draft.supplies >= rewardRules.maxSupplies"
            data-action="supply-plus"
            @click="emit('supplies', draft.supplies + 1)"
          >
            +
          </button>
          <small
            >{{ supplyPrice }} 预算 / 个 · 每个回复
            {{ supplyHeal(rewardState.offer.region, 1) }} 生命 · 合计
            {{ priced.supplyCost }}</small
          >
        </div>
      </div>
      <div class="reward-preview">
        <div>
          <span class="eyebrow">PERMANENT DECK</span>
          <p>
            牌组 {{ deckSize }} → {{ previewDeck }} 张
            <small v-if="draft.card" data-preview-card
              >+ {{ cards[draft.card]?.name }}</small
            >
            <small v-else>不收录新牌</small>
          </p>
        </div>
        <div>
          <span class="eyebrow">VITALITY</span>
          <p data-preview-hp>
            生命 {{ hp }} → {{ previewHp }}
            <small>治疗 {{ priced.heal }} + 补给 {{ supplyHp }}</small>
          </p>
        </div>
        <div>
          <span class="eyebrow">VOUCHER</span>
          <p data-preview-voucher>
            {{ priced.voucherValue }} 面值
            <small v-if="rewardState.offer.merchant"
              >绑定 {{ rewardState.offer.merchant.title }}</small
            >
            <small v-else>本条路线之后没有商店，无法生成凭证</small>
          </p>
        </div>
      </div>
      <p v-if="priced.voucherUnavailable" class="notice warn">
        没有可绑定的商店：剩余 {{ priced.remaining }} 预算无法兑换为凭证，提交后将作废。
      </p>
      <p v-if="!priced.valid" class="notice warn">{{ priced.reason }}</p>
      <div class="toolbar">
        <button
          data-action="claim"
          :disabled="!priced.valid"
          @click="emit('claim')"
        >
          确认组合并一起到账
        </button>
      </div>
    </div>
    <div v-else-if="rewardState.offer?.claimed" class="empty-mini">
      组合已提交：牌组、治疗与凭证已一起到账。
      <template v-if="rewardState.offer.commit">
        <br />本次消耗 {{ rewardState.offer.commit.spent }} 预算<span
          v-if="rewardState.offer.commit.card"
          >，收入 {{ cards[rewardState.offer.commit.card]?.name }}</span
        ><span v-if="rewardState.offer.commit.heal"
          >，回复
          {{
            rewardState.offer.commit.heal +
            supplyHeal(
              rewardState.offer.region,
              rewardState.offer.commit.supplies,
            )
          }}
          生命</span
        ><span v-if="rewardState.offer.commit.voucherValue"
          >，凭证 {{ rewardState.offer.commit.voucherValue }} 面值</span
        >。
      </template>
      <br v-if="rewardState.vouchers.length" />{{
        rewardState.vouchers.length
          ? "剩余凭证可在绑定的商人处使用。"
          : ""
      }}
    </div>
    <div v-else class="empty-mini">
      战胜敌人，冻结下一份胜利预算。
    </div>
  </section>
</template>
