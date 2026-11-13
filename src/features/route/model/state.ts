import { reactive, readonly } from "vue";
import type { Influence, JourneyContext } from "@/shared/domain";
import { makeMap } from "../lib/map";
import { available, contextFor, nextShop, reachableShops } from "../lib/rules";
const state = reactive({
  nodes: makeMap(),
  visited: [] as string[],
  resolved: true,
  influence: { heat: 0, favor: 0, scarcity: 0 } as Influence,
  preview: null as JourneyContext | null,
});
export const routeState = readonly(state);
/** 本次胜利之后仍可到达的下一家商店；没有则返回 null。 */
export function upcomingShop(fromNodeId: string) {
  const node = nextShop(state.nodes, fromNodeId);
  if (!node) return null;
  return {
    nodeId: node.id,
    region: node.region,
    depth: node.depth,
    title: node.title,
  };
}
/** 当前路线之后仍能走到的所有商店节点 id，用于判断凭证是否到期。 */
export function reachableShopIds(): string[] {
  const last = state.visited.at(-1);
  if (!last)
    return state.nodes.filter((n) => n.kind === "shop").map((n) => n.id);
  const current = state.nodes.find((n) => n.id === last);
  if (!current) return [];
  const ids = reachableShops(state.nodes, last).map((n) => n.id);
  // 玩家此刻正站在商店里（尚未离开）时，这家商店也可以使用凭证。
  if (!state.resolved && current.kind === "shop") ids.unshift(last);
  return [...new Set(ids)];
}
export function choices() {
  return available(state.nodes, state.visited, state.resolved);
}
export function previewRoute(id: string) {
  const n = state.nodes.find((n) => n.id === id);
  state.preview = n ? contextFor(n, state.influence) : null;
}
export function enterRoute(id: string): JourneyContext | null {
  if (!choices().includes(id)) return null;
  const node = state.nodes.find((n) => n.id === id)!;
  const context = contextFor(node, state.influence);
  state.visited.push(id);
  state.influence = context.influence;
  state.resolved = false;
  state.preview = null;
  return context;
}
export function resolveRoute() {
  state.resolved = true;
}
export function exportRoute() {
  return JSON.parse(
    JSON.stringify({
      visited: state.visited,
      resolved: state.resolved,
      influence: state.influence,
    }),
  );
}
export function restoreRoute(data: ReturnType<typeof exportRoute>) {
  state.visited = data.visited;
  state.resolved = data.resolved;
  state.influence = data.influence;
  state.preview = null;
}
export function resetRoute() {
  state.visited = [];
  state.resolved = true;
  state.influence = { heat: 0, favor: 0, scarcity: 0 };
  state.preview = null;
}
