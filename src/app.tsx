import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
const HomePage = lazy(() => import('@/pages/HomePage/HomePage'));
const ChatPage = lazy(() => import('@/pages/ChatPage/ChatPage'));
const KnowledgePage = lazy(() => import('@/pages/KnowledgePage/KnowledgePage'));
const ModelPage = lazy(() => import('@/pages/ModelPage/ModelPage'));
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';
import { useUiVersion } from '@/hooks/useUiVersion';
const ExhibitionPage = lazy(() => import('@/pages/ExhibitionPage/ExhibitionPage'));

function VersionedHomePage() {
  const version = useUiVersion();
  return version === 'new' ? <ExhibitionPage /> : <HomePage />;
}

export default function App() {
  return (
    <>
    <Suspense fallback={<div role="status" className="p-8 text-center text-muted-foreground">加载中 / Loading…</div>}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<VersionedHomePage />} />
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
