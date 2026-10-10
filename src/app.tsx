import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { LiquidGlassFilter } from '@sohumsuthar/liquid-glass';
import { useLiquidGlassEffects } from '@sohumsuthar/liquid-glass/hooks/useLiquidGlassEffects';
import displacementMap from '@/assets/lg-displacement.png?inline';
import '@sohumsuthar/liquid-glass/css/liquid-glass-core.css';
import '@sohumsuthar/liquid-glass/css/liquid-glass-effects.css';
const HomePage = lazy(() => import('@/pages/HomePage/HomePage'));
const ChatPage = lazy(() => import('@/pages/ChatPage/ChatPage'));
const KnowledgePage = lazy(() => import('@/pages/KnowledgePage/KnowledgePage'));
const ModelPage = lazy(() => import('@/pages/ModelPage/ModelPage'));
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';

export default function App() {
  const location = useLocation();
  // 高光只跟随小面积控件，避免全页聚光与滚动形变影响资料阅读。
  useLiquidGlassEffects({ spotlight: false, scroll: false, routeKey: `${location.pathname}${location.hash}` });
  return (
    <>
    <LiquidGlassFilter displacementMap={displacementMap} />
    <Suspense fallback={<div role="status" className="p-8 text-center text-muted-foreground">加载中 / Loading…</div>}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="models" element={<ModelPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
    </>
  );
}
