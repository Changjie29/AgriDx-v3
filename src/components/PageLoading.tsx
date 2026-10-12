import { useLang } from '@/hooks/useLang';

export default function PageLoading() {
  const lang = useLang();
  return <div className="mx-auto w-full max-w-6xl px-5 py-10" role="status" aria-live="polite">
    <p className="text-sm text-muted-foreground">{lang === 'zh' ? '页面加载中…' : 'Loading page…'}</p>
    <div className="mt-6 h-8 w-2/3 rounded-lg bg-muted" aria-hidden="true" />
    <div className="mt-4 h-4 w-1/2 rounded-lg bg-muted" aria-hidden="true" />
    <div className="mt-8 h-48 rounded-2xl bg-muted" aria-hidden="true" />
  </div>;
}
