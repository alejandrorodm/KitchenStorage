export type Topic = 'inventory' | 'meals' | 'shopping' | 'dishes';

type Listener = (topics: Topic[]) => void;

/** In-process pub/sub that pushes "data changed" notifications to the devices of one household. */
export class ChangeEvents {
  private readonly listeners = new Map<string, Set<Listener>>();

  subscribe(householdId: string, listener: Listener): () => void {
    const set = this.listeners.get(householdId) ?? new Set();
    set.add(listener);
    this.listeners.set(householdId, set);
    return () => {
      set.delete(listener);
      if (!set.size) this.listeners.delete(householdId);
    };
  }

  publish(householdId: string, ...topics: Topic[]): void {
    for (const listener of this.listeners.get(householdId) ?? []) listener(topics);
  }

  get size(): number {
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }
}
