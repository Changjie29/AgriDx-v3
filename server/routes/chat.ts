import { Router } from 'express';
import { DiagnosticInputError, parseDiagnosticRequest } from '../diagnosis/request';
import type { DiagnosticService } from '../diagnosis/service';

export function createChatRoutes(diagnose: DiagnosticService): Router {
  const router = Router();
  router.post('/chat', async (req, res) => {
    try {
      const input = parseDiagnosticRequest(req.body);
      res.json(await diagnose(input));
    } catch (error) {
      if (error instanceof DiagnosticInputError) {
        res.status(400).json({ error: error.message, code: error.code });
        return;
      }
      console.error('[chat] unexpected error:', error);
      res.status(502).json({ error: '智能诊断服务暂时无法连接，请稍后重试。', code: 'llm_unavailable' });
    }
  });
  return router;
}
