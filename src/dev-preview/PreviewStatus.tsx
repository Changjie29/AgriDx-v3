import { useEffect, useState } from 'react';
import { useLang } from '../hooks/useLang';
import { version } from '../../package.json';
import './preview.css';

export default function PreviewStatus() {
  const lang = useLang();
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (document.hidden || checking) return;
      checking = true;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}dev-preview.json?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const latest = await response.json();
        if (typeof latest.commit === 'string' && latest.commit !== __AGRIDX_PREVIEW_RELEASE__.commit) setUpdateReady(true);
      } catch { /* Keep the preview usable during an interrupted connection. */ }
      finally { checking = false; }
    };
    const timer = window.setInterval(() => { void check(); }, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return <aside className="dev-preview-status" aria-label={lang === 'zh' ? '开发预览状态' : 'Development preview status'}>
    <span>{lang === 'zh' ? '开发预览 · 本地知识检索' : 'Dev preview · local knowledge'} · {version}</span>
    {updateReady && <button type="button" onClick={() => window.location.reload()}>{lang === 'zh' ? '新版已就绪，刷新' : 'Update ready · reload'}</button>}
  </aside>;
}
