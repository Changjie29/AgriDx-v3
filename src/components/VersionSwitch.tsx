import { useLang } from '@/hooks/useLang';
import { setUiVersion, useUiVersion, type UiVersion } from '@/hooks/useUiVersion';
import './version-switch.css';

export default function VersionSwitch({ exhibition = false, onChange }: { exhibition?: boolean; onChange?: () => void }) {
  const version = useUiVersion();
  const lang = useLang();
  const items: { id: UiVersion; zh: string; en: string }[] = [
    { id: 'new', zh: '新版', en: 'New' }, { id: 'old', zh: '旧版', en: 'Classic' },
  ];
  return <div className={`ui-version-switch${exhibition ? ' is-exhibition' : ''}`} role="group" aria-label={lang === 'zh' ? '切换界面版本' : 'Interface version'}>
    {items.map(item => <button type="button" key={item.id} aria-pressed={version === item.id} onClick={() => { setUiVersion(item.id); onChange?.(); }}>
      {lang === 'zh' ? item.zh : item.en}
    </button>)}
  </div>;
}
