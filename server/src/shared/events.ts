export type Topic = 'inventory' | 'meals' | 'shopping';

type Listener = (topics: Topic[]) => void;

/** In-process pub/sub used to push "data changed" notifications to every connected device. */
export class ChangeEvents {
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(...topics: Topic[]): void {
    for (const listener of this.listeners) listener(topics);
  }

  get size(): number {
    return this.listeners.size;
  }
}
