import { Router } from 'express';
import type { CatalogFilters } from '../../shared/knowledge-catalog';
import type { ServerRuntime } from '../runtime';

export function createCatalogRoutes(getCatalog: ServerRuntime['getCatalog']): Router {
  const router = Router();
  router.get('/knowledge/catalog', (req, res) => {
    const filters: CatalogFilters = {};
    for (const field of ['brand', 'model', 'component', 'part'] as const) {
      const value = req.query[field];
      if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 100)) {
        res.status(400).json({ error: '目录筛选须为非空文本（各上限100字符）', code: 'bad_request' });
        return;
      }
      if (typeof value === 'string') filters[field] = value.trim();
    }
    if ((filters.model && !filters.brand) || (filters.component && !filters.model) || (filters.part && !filters.component)) {
      res.status(400).json({ error: '请依次选择品牌、完整型号、组件和零部件', code: 'bad_request' });
      return;
    }
    try {
      res.json(getCatalog(filters));
    } catch (error) {
      if (error instanceof RangeError) {
        res.status(404).json({ error: error.message, code: 'knowledge_not_found' });
        return;
      }
      console.error('[catalog] unexpected error:', error);
      res.status(500).json({ error: '知识目录暂时无法读取，请稍后重试', code: 'catalog_unavailable' });
    }
  });
  return router;
}
