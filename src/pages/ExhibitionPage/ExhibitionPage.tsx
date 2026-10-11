import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowRight, BookOpen, Box, ChevronRight, CircleHelp, Cpu, FileText, Focus, Globe, Layers3, Maximize, MessageSquare, Pause, Play, RotateCcw, Search, ShieldCheck, Tractor, Wrench } from 'lucide-react';
import VersionSwitch from '@/components/VersionSwitch';
import { useLang, setLang } from '@/hooks/useLang';
import { useUiVersion, setUiVersion } from '@/hooks/useUiVersion';
import { useKnowledgeCatalog } from '@/hooks/useKnowledgeCatalog';
import type { TractorComponent } from '@/components/TractorModel';
import type { ExhibitionView } from './ExhibitionModel';
import { version as appVersion } from '../../../package.json';
import './exhibition.css';

const ExhibitionModel = lazy(() => import('./ExhibitionModel'));
const COMPONENTS: { id: TractorComponent; zh: string; en: string }[] = [
  { id: 'all', zh: '整机', en: 'All' }, { id: 'engine', zh: '发动机', en: 'Engine' },
  { id: 'drivetrain', zh: '传动', en: 'Drive' }, { id: 'hydraulics', zh: '液压', en: 'Hydraulics' },
  { id: 'electrical', zh: '电气', en: 'Electrical' }, { id: 'wheels', zh: '行走', en: 'Wheels' },
];

export default function ExhibitionPage() {
  const lang = useLang();
  const t = (zh: string, en: string) => lang === 'zh' ? zh : en;
  const navigate = useNavigate();
  const version = useUiVersion();
  const { catalog, loading, failed, retry } = useKnowledgeCatalog();
  const [search, setSearch] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const [component, setComponent] = useState<TractorComponent>('all');
  const [exploded, setExploded] = useState(false);
  const [view, setView] = useState<ExhibitionView>('overview');
  const [rotating, setRotating] = useState(false);
  const [reset, setReset] = useState(0);
  const [notice, setNotice] = useState('');
  const [time, setTime] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setTime(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4000); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing && !target.isContentEditable && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        event.preventDefault(); searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const models = (catalog?.brands ?? []).flatMap(brand => brand.models.map(model => ({ ...model, brandId: brand.id, brandName: brand.name })));
  const filtered = models.filter(model => `${model.name} ${model.brandName}`.toLowerCase().includes(search.trim().toLowerCase()));
  const totals = !failed ? catalog?.totals : undefined;
  const number = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString();
  const selectedComponent = COMPONENTS.find(item => item.id === component)!;
  const mapped = totals?.mappedEntries ?? 0;
  const ratio = totals?.entries ? mapped / totals.entries * 100 : 0;
  const openResearch = () => { setUiVersion('old'); navigate('/', { state: { scrollTo: 'research' } }); };
  const resetModel = () => { setView('overview'); setComponent('all'); setExploded(false); setRotating(false); setReset(value => value + 1); };
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice(t('当前浏览器不支持全屏，可使用浏览器的全屏菜单。', 'Use your browser’s full-screen menu.')); }
  }
  const modules = [
    { id: 'A', title: t('装备展示', 'Equipment'), desc: t('从整机到组件，理解机械结构', 'Explore the machine and its components'), icon: Tractor, path: '/models', active: true },
    { id: 'B', title: t('农机知识', 'Knowledge'), desc: t('品牌 · 型号 · 组件 · 零部件', 'Brand · model · component · part'), icon: BookOpen, path: '/knowledge' },
    { id: 'C', title: t('智能诊断', 'Diagnosis'), desc: t('结合适用资料，梳理排查路径', 'Find a source-backed diagnostic path'), icon: Cpu, path: '/chat' },
    { id: 'D', title: t('研究依据', 'Research'), desc: t('追溯方法、文献与能力边界', 'Explore methods, evidence and scope'), icon: Layers3, path: null },
  ];
  return <div className="expo-page" data-ui-version={version}>
    <a className="skip-link" href="#expo-main">{t('跳到主要内容', 'Skip to content')}</a>
    <header className="expo-header">
      <div className="expo-brand"><a href="https://coe.njau.edu.cn/" target="_blank" rel="noopener noreferrer" className="expo-college-mark" aria-label={t('南京农业大学工学院官网首页', 'College of Engineering, NAU official homepage')}><img src="/images/njau-engineering-mark.jpg" alt={t('南京农业大学工学院院徽', 'College of Engineering, NAU emblem')} width="857" height="411" /></a><Link to="/" className="expo-wordmark"><strong>耕知 · 耘诊</strong><small>AGRIDX · DIGITAL HUB</small></Link></div>
      <div className="expo-title"><span className="expo-title-line" aria-hidden="true" /><h1>{t('农机装备数字展示大厅', 'AGRICULTURAL EQUIPMENT HUB')}</h1><p>AGRICULTURAL MACHINERY · KNOWLEDGE & EXPLORATION</p></div>
      <div className="expo-header-tools"><VersionSwitch exhibition /><button type="button" className="expo-icon-button" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} aria-label={t('切换语言', 'Switch language')}><Globe size={17} /><span>{lang === 'zh' ? 'EN' : '中'}</span></button><button type="button" className="expo-icon-button expo-fullscreen" onClick={() => void fullscreen()} aria-label={t('切换全屏', 'Toggle full screen')}><Maximize size={17} /></button></div>
    </header>
    <div className="expo-subheader"><span><i />{t('探索装备 · 连接知识 · 辅助诊断', 'EXPLORE EQUIPMENT · CONNECT KNOWLEDGE')}</span><time dateTime={time.toISOString()}>{time.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })}<small>UTC+8</small></time></div>
    <main id="expo-main" className="expo-main" tabIndex={-1}>
      <aside className="expo-left">
        <div className="expo-panel-label"><span>01</span>{t('功能展区', 'EXPLORE')}</div>
        <nav className="expo-modules" aria-label={t('功能展区导航', 'Feature navigation')}>
          {modules.map(module => { const Icon = module.icon; const content = <><span className="expo-module-icon"><Icon size={25} strokeWidth={1.4} /></span><span className="expo-module-copy"><small>{module.id} {t('展区', 'ZONE')}</small><strong>{module.title}</strong><span>{module.desc}</span></span><ChevronRight size={17} /></>; return module.path ? <Link className={`expo-module${module.active ? ' is-active' : ''}`} key={module.id} to={module.path}>{content}</Link> : <button type="button" className="expo-module" key={module.id} onClick={openResearch}>{content}</button>; })}
        </nav>
        <section className="expo-panel expo-intro"><div className="expo-panel-heading"><h2><Box size={17} />{t('展厅概况', 'ABOUT THE HUB')}</h2><span>AGRIDX</span></div><p>{t('围绕农机结构与维修知识，把三维探索、资料检索和诊断对话连接在同一个工作入口。', 'A connected workspace for 3D exploration, machine evidence and diagnostic conversations.')}</p><div className="expo-intro-counts"><div><strong>4<small>{t('个', '')}</small></strong><span>{t('功能展区', 'FEATURE ZONES')}</span></div><div><strong>1<small>{t('台', '')}</small></strong><span>{t('结构示意模型', 'SCHEMATIC MODEL')}</span></div></div><div className="expo-intro-note"><ShieldCheck size={14} />{t('资料可追溯 · 适用范围可核对', 'TRACEABLE SOURCES · CLEAR SCOPE')}</div></section>
      </aside>
      <section className="expo-center" aria-label={t('农机结构展示', 'Machine structure display')}>
        <div className="expo-stage">
          <div className="expo-stage-heading"><div><span className="expo-eyebrow">A {t('展区 / 装备展示', 'ZONE / EQUIPMENT')}</span><h2>{t('看见结构，理解装备。', 'Explore the structure.')}<small>{t('原创拖拉机结构示意', 'Original tractor schematic')}</small></h2></div><span className="expo-outline-badge"><i />3D {t('互动展示', 'INTERACTIVE')}</span></div>
          <div className="expo-stage-grid" aria-hidden="true" />
          <div className="expo-model"><Suspense fallback={<div className="expo-model-loading" role="status">{t('加载三维展示…', 'Loading 3D display…')}</div>}><ExhibitionModel component={component} exploded={exploded} view={view} rotating={rotating} reset={reset} onInteraction={() => setRotating(false)} /></Suspense></div>
          <div className="expo-model-label"><span><Focus size={15} />{t(selectedComponent.zh, selectedComponent.en)}</span><small>{t('结构示意 · 非实测 CAD', 'SCHEMATIC · NOT MEASURED CAD')}</small></div>
          <div className="expo-model-tip">{t('拖动旋转 · 滚轮缩放', 'DRAG TO ROTATE · SCROLL TO ZOOM')}</div>
          <div className="expo-model-toolbar" role="group" aria-label={t('三维视图控制', '3D view controls')}><button type="button" aria-pressed={view === 'overview'} onClick={() => setView('overview')}><Box size={15} />{t('总览', 'Overview')}</button><button type="button" aria-pressed={view === 'top'} onClick={() => setView('top')}><ArrowDownLeft size={15} />{t('俯视', 'Top')}</button><span /><button type="button" aria-pressed={rotating} onClick={() => setRotating(!rotating)} aria-label={rotating ? t('暂停旋转', 'Pause rotation') : t('自动旋转', 'Auto rotate')}>{rotating ? <Pause size={15} /> : <Play size={15} />}{t('旋转', 'Rotate')}</button><button type="button" onClick={resetModel} aria-label={t('重置模型', 'Reset model')}><RotateCcw size={15} />{t('重置', 'Reset')}</button></div>
        </div>
        <section className="expo-panel expo-structure"><div className="expo-panel-heading"><h2><Layers3 size={17} />{t('结构探索', 'EXPLORE COMPONENTS')}</h2><label className="expo-expand"><span>{t('展开结构', 'Explode')}</span><input type="checkbox" checked={exploded} onChange={event => setExploded(event.target.checked)} /></label></div><div className="expo-components">{COMPONENTS.map(item => <button type="button" key={item.id} onClick={() => setComponent(item.id)} aria-pressed={component === item.id}>{t(item.zh, item.en)}</button>)}</div><div className="expo-structure-footer"><p><CircleHelp size={13} />{t('示意模型帮助理解位置关系；维修须核对具体机型资料。', 'Use model-specific evidence for maintenance.')}</p><Link to="/models">{t('进入模型工坊', 'Model studio')}<ArrowRight size={14} /></Link></div></section>
      </section>
      <aside className="expo-right">
        <section className="expo-panel expo-overview"><div className="expo-panel-heading"><h2><span className="expo-heading-line" />{t('知识资产概览', 'KNOWLEDGE ASSETS')}</h2><span className="expo-live-label">{t('归档目录', 'ARCHIVE')}</span></div><div className="expo-overview-main"><div className="expo-donut" style={{ '--expo-ratio': `${ratio}%` } as CSSProperties}><div><strong>{number(totals?.entries)}</strong><span>{t('条索引资料', 'INDEXED ENTRIES')}</span></div></div><dl><div><dt><i />{t('资料来源', 'Sources')}</dt><dd>{number(totals?.sources)}</dd></div><div><dt><i />{t('品牌目录', 'Brands')}</dt><dd>{number(totals?.brands)}</dd></div><div><dt><i />{t('型号 / 系列', 'Models / series')}</dt><dd>{number(totals?.models)}</dd></div></dl></div><p className="expo-data-note">{t('数量取自知识目录，不代表全机型覆盖。', 'Archive counts, not validated whole-machine coverage.')}</p></section>
        <section className="expo-panel expo-catalog"><div className="expo-panel-heading"><h2><span className="expo-heading-line" />{t('设备资料', 'MACHINE EVIDENCE')}</h2><Link to="/knowledge">{t('全部', 'All')}<ChevronRight size={13} /></Link></div><label className="expo-search"><Search size={15} /><input ref={searchInput} type="search" value={search} onChange={event => setSearch(event.target.value.slice(0, 100))} placeholder={t('搜索品牌或型号', 'Search brand or model')} aria-label={t('搜索设备资料', 'Search machine evidence')} /><kbd>/</kbd></label><div className="expo-catalog-columns"><span>{t('品牌 / 型号', 'BRAND / MODEL')}</span><span>{t('资料范围', 'SCOPE')}</span></div><div className="expo-catalog-list" aria-live="polite">
          {loading ? <div className="expo-catalog-state" role="status">{t('正在读取知识目录…', 'Loading the catalog…')}</div> : failed ? <div className="expo-catalog-state" role="alert"><p>{t('知识目录暂不可用', 'Catalog unavailable')}</p><button type="button" onClick={retry}>{t('重新加载', 'Retry')}</button></div> : filtered.length ? filtered.map(model => <Link key={`${model.brandId}/${model.id}`} to={`/knowledge?${new URLSearchParams({ brand: model.brandId, model: model.id })}`} className="expo-catalog-row"><div><strong>{model.name}</strong><small>{model.brandName} · {model.entryCount} {t('条资料', 'entries')}</small></div><span className={`expo-scope scope-${model.scope}`}>{model.scope === 'exact' ? t('具体型号', 'Model') : model.scope === 'series' ? t('系列', 'Series') : t('待核实', 'Pending')}</span></Link>) : <div className="expo-catalog-state">{t('没有匹配的资料，请试试其他品牌或型号。', 'No matching documents. Try another brand or model.')}</div>}
        </div><div className="expo-catalog-bottom"><FileText size={13} />{t('型号与配置须与现场铭牌核对', 'CHECK MODEL & CONFIGURATION')}</div></section>
      </aside>
    </main>
    <section className="expo-shortcuts" aria-label={t('快捷入口', 'Quick access')}><div className="expo-shortcuts-title"><span>EXPLORE MORE</span><h2>{t('让知识与装备连接', 'Connect knowledge & equipment')}</h2><p>{t('从观察，到理解，再到行动。', 'From observation to understanding.')}</p></div>{[
      { icon: BookOpen, title: t('农机知识库', 'Knowledge'), desc: t('查来源 · 查适用范围', 'Sources & scope'), path: '/knowledge' },
      { icon: MessageSquare, title: t('诊断工作台', 'Diagnosis'), desc: t('描述现象 · 获取排查路径', 'Symptoms & troubleshooting'), path: '/chat' },
      { icon: Wrench, title: t('模型工坊', 'Model studio'), desc: t('结构探索 · 导入 GLB', 'Components & GLB import'), path: '/models' },
    ].map(item => { const Icon = item.icon; return <Link key={item.path} to={item.path} className="expo-shortcut"><Icon size={27} strokeWidth={1.25} /><div><h3>{item.title}</h3><p>{item.desc}</p></div><ArrowRight size={17} /></Link>; })}</section>
    <footer className="expo-footer"><span>AGRIDX <i />{t('农机装备与知识探索平台', 'EQUIPMENT & KNOWLEDGE EXPLORATION')}</span><span>v{appVersion} <i />{t('传感器与实车孪生待接入', 'SENSOR & PHYSICAL TWIN INTEGRATION PLANNED')}</span></footer>
    {notice && <div className="expo-notice" role="status">{notice}</div>}
  </div>;
}
