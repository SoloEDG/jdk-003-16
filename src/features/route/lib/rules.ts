import type { Influence, RouteNode, JourneyContext } from "@/shared/domain";
export function accumulate(a: Influence, b: Influence): Influence {
  return {
    heat: a.heat + b.heat,
    favor: a.favor + b.favor,
    scarcity: a.scarcity + b.scarcity,
  };
}
export function contextFor(
  node: RouteNode,
  influence: Influence,
): JourneyContext {
  return {
    nodeId: node.id,
    region: node.region,
    depth: node.depth,
    kind: node.kind,
    influence: accumulate(influence, node.influence),
  };
}
export function available(
  nodes: RouteNode[],
  visited: string[],
  resolved: boolean,
): string[] {
  if (!visited.length)
    return nodes.filter((n) => n.depth === 0).map((n) => n.id);
  if (!resolved) return [];
  return nodes.find((n) => n.id === visited.at(-1))?.next ?? [];
}
/**
 * 从某个节点出发，沿路线图找到最近的商店。
 * 凭证绑定的是这个“还可以走到的”商人，而不是地图上任意一个商店。
 */
export function nextShop(
  nodes: RouteNode[],
  fromId: string,
): RouteNode | null {
  const shops = reachableShops(nodes, fromId);
  return shops[0] ?? null;
}
/** 从某个节点出发，所有仍可到达的商店（按深度由近到远）。 */
export function reachableShops(nodes: RouteNode[], fromId: string): RouteNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const queue = [fromId];
  const seen = new Set<string>();
  const shops: RouteNode[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;
    for (const nextId of node.next) {
      const next = byId.get(nextId);
      if (!next) continue;
      if (next.kind === "shop") shops.push(next);
      else queue.push(nextId);
    }
  }
  return shops.sort((a, b) => a.depth - b.depth);
}
