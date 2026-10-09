import { useEffect, useState } from 'react';
import type { KnowledgeCatalog } from '@shared/knowledge-catalog';

export function useKnowledgeCatalog(query = '') {
  const [catalog, setCatalog] = useState<KnowledgeCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setLoading(true);
    setFailed(false);
    const load = async () => {
      try {
        const response = await fetch(`/api/knowledge/catalog${query ? `?${query}` : ''}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Catalog request failed');
        const data: KnowledgeCatalog = await response.json();
        if (!Array.isArray(data.brands) || !data.totals) throw new Error('Invalid catalog');
        if (active) setCatalog(data);
      } catch {
        if (active) setFailed(true);
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [query, revision]);
  return { catalog, loading, failed, retry: () => setRevision(value => value + 1) };
}
