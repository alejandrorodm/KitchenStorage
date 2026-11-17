import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Keeps every open device in sync: the server pushes the topics that changed
 * and we refetch only those. After a reconnect everything is refetched, since
 * events may have been missed while offline.
 */
export function useLiveSync(enabled: boolean) {
  const client = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource('/api/events');
    let wasDisconnected = false;

    source.onopen = () => {
      if (wasDisconnected) void client.invalidateQueries();
      wasDisconnected = false;
    };
    source.onerror = () => {
      wasDisconnected = true;
    };
    source.onmessage = (event) => {
      const { topics } = JSON.parse(event.data) as { topics: string[] };
      for (const topic of new Set(topics)) void client.invalidateQueries({ queryKey: [topic] });
    };

    return () => source.close();
  }, [client, enabled]);
}
