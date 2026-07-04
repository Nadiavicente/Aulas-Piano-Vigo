import "server-only";

interface FlowEdge {
  from: number;
  to: number;
  cap: number;
  cost: number;
  flow: number;
}

/**
 * Flujo de coste mínimo por caminos de coste mínimo sucesivos (SPFA/
 * Bellman-Ford, admite costes con aristas de reversa negativas). Pensado
 * para grafos pequeños (decenas/cientos de nodos): se usa para repartir
 * horas de estudio entre participantes y franjas horarias garantizando el
 * máximo aforo posible, no solo una aproximación.
 */
export class MinCostFlow {
  private graph: number[][];
  private edges: FlowEdge[] = [];

  constructor(private n: number) {
    this.graph = Array.from({ length: n }, () => []);
  }

  addEdge(from: number, to: number, cap: number, cost: number) {
    this.graph[from].push(this.edges.length);
    this.edges.push({ from, to, cap, cost, flow: 0 });
    this.graph[to].push(this.edges.length);
    this.edges.push({ from: to, to: from, cap: 0, cost: -cost, flow: 0 });
  }

  /** Devuelve el flujo total conseguido y el flujo de cada arista original (por índice de addEdge). */
  run(source: number, sink: number): { totalFlow: number; totalCost: number } {
    let totalFlow = 0;
    let totalCost = 0;

    while (true) {
      const dist = new Array(this.n).fill(Infinity);
      const inQueue = new Array(this.n).fill(false);
      const prevEdge = new Array(this.n).fill(-1);
      dist[source] = 0;
      const queue: number[] = [source];
      inQueue[source] = true;

      while (queue.length > 0) {
        const u = queue.shift()!;
        inQueue[u] = false;
        for (const edgeId of this.graph[u]) {
          const e = this.edges[edgeId];
          if (e.cap - e.flow > 0 && dist[u] + e.cost < dist[e.to]) {
            dist[e.to] = dist[u] + e.cost;
            prevEdge[e.to] = edgeId;
            if (!inQueue[e.to]) {
              queue.push(e.to);
              inQueue[e.to] = true;
            }
          }
        }
      }

      if (dist[sink] === Infinity) break;

      let aug = Infinity;
      let v = sink;
      while (v !== source) {
        const e = this.edges[prevEdge[v]];
        aug = Math.min(aug, e.cap - e.flow);
        v = e.from;
      }

      v = sink;
      while (v !== source) {
        const edgeId = prevEdge[v];
        this.edges[edgeId].flow += aug;
        this.edges[edgeId ^ 1].flow -= aug;
        v = this.edges[edgeId].from;
      }

      totalFlow += aug;
      totalCost += aug * dist[sink];
    }

    return { totalFlow, totalCost };
  }

  /** Flujo final de la arista i-ésima añadida (0-indexado según el orden de addEdge, ignorando las de reversa). */
  flowOfEdge(originalEdgeIndex: number): number {
    return this.edges[originalEdgeIndex * 2].flow;
  }
}
