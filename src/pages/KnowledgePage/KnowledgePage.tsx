import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, FileText, Layers, Loader2, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLang } from '@/hooks/useLang';
import { useKnowledgeCatalog } from '@/hooks/useKnowledgeCatalog';
import type { CatalogEntry } from '@shared/knowledge-catalog';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import '@/control-glass.css';

const INFORMATION_TYPES = new Set(['资料索引', '资料核验', '机型资料', '资料缺口', '系统适用边界']);

export default function KnowledgePage() {
  const lang = useLang();
  const t = (zh: string, en: string) => lang === 'zh' ? zh : en;
  const [params, setParams] = useSearchParams();
  const filters = ['brand', 'model', 'component', 'part'] as const;
  const query = new URLSearchParams();
  filters.forEach(key => { const value = params.get(key); if (value) query.set(key, value); });
  const { catalog, loading, failed, retry } = useKnowledgeCatalog(query.toString());
  const brand = catalog?.brands.find(item => item.id === params.get('brand'));
  const model = brand?.models.find(item => item.id === params.get('model'));
  const component = model?.components.find(item => item.id === params.get('component'));
  const part = component?.parts.find(item => item.id === params.get('part'));
  const selected = catalog?.selected;
  const updateFilter = (key: typeof filters[number], value: string) => {
    const next = new URLSearchParams(params);
    const index = filters.indexOf(key);
    filters.slice(index).forEach(item => next.delete(item));
    if (value) next.set(key, value);
    setParams(next);
  };
  const machineState = (entry?: CatalogEntry) => ({
    machineType: model?.machineType === '待核实' ? '' : model?.machineType,
    brand: brand?.name,
    model: model?.scope === 'exact' ? model.name : '',
    question: entry ? t(`关于${brand?.name || ''}${model?.name || ''}的“${entry.title}”，${INFORMATION_TYPES.has(entry.entryType) ? '请说明资料来源、适用范围与需要补充核实的信息。' : '请结合适用资料说明故障表现、排查顺序及处置策略。'}${model?.scope !== 'exact' ? '完整型号与配置待确认，请先提示我需要补充哪些信息。' : ''}`, `For ${brand?.name || ''} ${model?.name || ''}: ${entry.title}. ${INFORMATION_TYPES.has(entry.entryType) ? 'Explain the source, applicability and information that needs verification.' : 'Explain symptoms, troubleshooting and action from applicable sources.'}${model?.scope !== 'exact' ? ' The complete model and configuration need confirmation; ask me what is missing first.' : ''}`) : '',
  });
  const scopeLabel = model?.scope === 'exact' ? t('具体型号目录 · 配置仍需核对', 'Specific-model directory · check configuration') : model?.scope === 'series' ? t('系列资料 · 不等同于全部型号', 'Series documents · not every individual model') : t('完整型号待核实', 'Complete model needs verification');

  return <div className="knowledge-page">
    <div className="page-container">
      <Link to="/" className="knowledge-back"><ArrowLeft size={15} />{t('返回首页', 'Back to home')}</Link>
      <header className="knowledge-page-heading">
        <div><div className="section-eyebrow">{t('耕知 · 农机知识', 'GENGZHI · MACHINE KNOWLEDGE')}</div><h1>{t('从整机现象，找到部件依据。', 'Find part-level evidence for machine behavior.')}</h1><p>{t('四级浏览已整理的故障、维护与安全资料。数量代表已索引记录，不代表全部机型与性能已经核验覆盖。', 'Browse archived fault, maintenance and safety documents through four levels. Counts reflect indexed records, not validated coverage of every model or performance dimension.')}</p></div>
        <div className="knowledge-heading-icon" aria-hidden="true"><Layers size={38} strokeWidth={1.15} /><span>01 — 04</span></div>
      </header>

      <div className="catalog-stats" aria-live="polite">
        {[
          [catalog?.totals.entries, t('已索引资料', 'Archived entries')],
          [catalog?.totals.faultEntries, t('维护 / 故障条目', 'Maintenance / fault entries')],
          [catalog?.totals.brands, t('品牌目录', 'Brand directories')],
          [catalog?.totals.models, t('型号 / 系列目录', 'Model / series directories')],
        ].map(([value, label]) => <div key={String(label)}><strong>{typeof value === 'number' ? value.toLocaleString() : '—'}</strong><span>{label}</span></div>)}
      </div>

      <section className="catalog-filter-section" aria-labelledby="catalog-select-heading">
        <LiquidGlass variant="regular" className="catalog-browser catalog-filter-glass" contentClassName="catalog-filter-content">
        <div className="catalog-browser-top"><h2 id="catalog-select-heading"><Search size={18} />{t('找到你的农机', 'Find your machine')}</h2><button onClick={() => setParams({})} className="catalog-reset">{t('重置选择', 'Reset selection')}</button></div>
        <div className="catalog-selectors">
          <label><span>01 {t('品牌', 'Brand')}</span><select aria-label={t('知识浏览品牌', 'Knowledge brand')} value={brand?.id || ''} onChange={event => updateFilter('brand', event.target.value)} disabled={loading}><option value="">{t('选择品牌', 'Choose a brand')}</option>{catalog?.brands.map(item => <option key={item.id} value={item.id}>{item.name} · {item.entryCount}{t(' 条', ' entries')}</option>)}</select></label>
          <label><span>02 {t('型号 / 系列', 'Model / series')}</span><select aria-label={t('知识浏览型号', 'Knowledge model')} value={model?.id || ''} onChange={event => updateFilter('model', event.target.value)} disabled={!brand || loading}><option value="">{t('选择目录，核对范围', 'Choose & check scope')}</option>{brand?.models.map(item => <option key={item.id} value={item.id}>{item.name}{item.scope === 'series' ? t('（系列）', ' (series)') : item.scope === 'pending' ? t('（待核实）', ' (unconfirmed)') : ''}</option>)}</select></label>
          <label><span>03 {t('组件', 'Component')}</span><select aria-label={t('知识浏览组件', 'Knowledge component')} value={component?.id || ''} onChange={event => updateFilter('component', event.target.value)} disabled={!model || loading}><option value="">{t('查看全部组件', 'All components')}</option>{model?.components.map(item => <option key={item.id} value={item.id}>{item.name} · {item.entryCount ? t(`${item.entryCount} 条`, `${item.entryCount} entries`) : t('待补资料', 'Missing evidence')}</option>)}</select></label>
          <label><span>04 {t('零部件', 'Part')}</span><select aria-label={t('知识浏览零部件', 'Knowledge part')} value={part?.id || ''} onChange={event => updateFilter('part', event.target.value)} disabled={!component || !component.parts.length || loading}><option value="">{component && !component.parts.length ? t('待细分零部件', 'Parts not yet identified') : t('查看全部零部件', 'All identified parts')}</option>{component?.parts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.entryCount}{t(' 条', ' entries')}</option>)}</select></label>
        </div>
        </LiquidGlass>
      </section>

      {loading && <div className="catalog-state" role="status"><Loader2 className="animate-spin" size={24} /><p>{t('读取适用资料与覆盖范围…', 'Loading documents and coverage…')}</p></div>}
      {failed && <div className="catalog-state" role="alert"><TriangleAlert size={26} /><h2>{t('暂时无法读取知识目录', 'Knowledge catalog is unavailable')}</h2><p>{t('目录未加载，不展示推测的数量或故障策略。请重试。', 'No catalog is loaded, so no estimated counts or strategies are shown. Please retry.')}</p><button onClick={retry} className="catalog-action">{t('重新加载', 'Retry')}</button></div>}

      {!loading && !failed && !model && <section className="catalog-onboarding"><div><BookOpen size={30} strokeWidth={1.3} /><h2>{t('先选品牌，再确认完整机型。', 'Choose a brand, then confirm the machine.')}</h2><p>{t('从故障表现向下查部件，也可以从零部件资料向上理解影响。系列资料、型号未确认资料与具体型号分别显示，来源没有明确的关系会保留缺口。', 'Trace symptoms down to components, or explore part evidence to understand higher-level effects. Series, unconfirmed and specific-model documents stay distinct; unsupported relationships remain gaps.')}</p></div><div className="catalog-brand-pills">{catalog?.brands.map(item => <button onClick={() => updateFilter('brand', item.id)} key={item.id} aria-pressed={brand?.id === item.id}>{item.name}<ChevronRight size={15} /></button>)}</div></section>}

      {!loading && !failed && model && <>
        <section className="catalog-selection-heading"><div><div className="catalog-breadcrumb">{[brand?.name, model.name, component?.name, part?.name].filter(Boolean).map((name, index) => <span key={`${name}-${index}`}>{index > 0 && <ChevronRight size={13} />}{name}</span>)}</div><h2>{part?.name || component?.name || model.name}<span className={`scope-badge ${model.scope === 'exact' ? 'scope-specific' : ''}`}>{scopeLabel}</span></h2><p>{t('型号与配置必须与现场铭牌核对；机型目录存在，不等于零部件及整机性能已全覆盖。', 'Check the full model and configuration against the machine plate. A directory does not imply complete part or whole-machine coverage.')}</p></div><Link to="/chat" state={machineState()} className="catalog-action">{model.scope === 'exact' ? t('带机型去诊断', 'Diagnose this model') : t('带品牌去诊断', 'Diagnose this brand')}<ArrowRight size={16} /></Link></section>

        <div className="component-coverage" aria-label={t('组件资料覆盖', 'Component coverage')}>{model.components.map(item => <button key={item.id} onClick={() => updateFilter('component', component?.id === item.id ? '' : item.id)} aria-pressed={component?.id === item.id} className={`${component?.id === item.id ? 'selected' : ''} ${item.entryCount === 0 ? 'coverage-gap' : ''}`}><span>{item.entryCount ? <Check size={15} /> : <TriangleAlert size={15} />}{item.name}</span><strong>{item.entryCount ? t(`${item.entryCount} 条资料`, `${item.entryCount} entries`) : t('待补资料', 'Missing evidence')}</strong><small>{t(`维护/故障 ${item.faultCount} · 已定位 ${item.parts.length} 类零部件`, `${item.faultCount} maintenance/fault · ${item.parts.length} identified part types`)}</small>{item.unresolvedPartCount > 0 && <small>{t(`${item.unresolvedPartCount} 条尚未明确零部件`, `${item.unresolvedPartCount} entries do not identify a part`)}</small>}</button>)}</div>

        {selected?.gaps.length ? <aside className="catalog-gaps"><TriangleAlert size={18} /><div><strong>{t('当前层级的资料缺口', 'Evidence gaps at this level')}</strong><ul>{selected.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul></div></aside> : null}

        <section className="catalog-evidence" aria-labelledby="catalog-evidence-heading"><div className="catalog-evidence-heading"><h2 id="catalog-evidence-heading">{selected?.entries.length && selected.entries.every(entry => INFORMATION_TYPES.has(entry.entryType)) ? t('资料状态与适用范围', 'Document status & applicability') : t('故障、维护与安全资料', 'Fault, maintenance & safety evidence')}</h2><span>{t('按原始资料呈现 · 保留适用边界', 'From archived documents · scope preserved')}</span></div>
          {selected?.entries.length ? selected.entries.map(entry => <details className="evidence-entry" key={entry.entryId}><summary><FileText size={20} strokeWidth={1.4} /><div><h3>{entry.title}</h3><span>{entry.entryType} · {entry.locator || t('定位待核实', 'Locator unconfirmed')} · {entry.status}</span></div><ChevronRight size={18} className="evidence-toggle" /></summary><div className="evidence-entry-body"><dl className="evidence-provenance"><div><dt>{t('资料来源', 'Source')}</dt><dd>{entry.sourceUrl ? <a href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.sourceId}</a> : entry.sourceId}</dd></div><div><dt>{t('版次 / 定位', 'Version / locator')}</dt><dd>{entry.version || t('版次待核实', 'Version unconfirmed')} · {entry.locator}</dd></div><div><dt>{t('适用范围', 'Applicability')}</dt><dd>{entry.scopeBoundary || t('待核实', 'Needs verification')}</dd></div></dl><div className="prose prose-sm max-w-none overflow-x-auto dark:prose-invert"><ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown></div><div className="evidence-entry-footer"><span><ShieldCheck size={15} />{t('资料没有给出的数值与关联，需进一步核实。', 'Unspecified parameters and relationships need verification.')}</span><Link to="/chat" state={machineState(entry)} className="hero-text-link">{t('围绕这条资料提问', 'Ask about this evidence')}<ArrowRight size={15} /></Link></div></div></details>) : <div className="catalog-empty"><BookOpen size={25} /><p>{t('这一层级暂无已归档资料，请换一个组件或零部件查看。', 'No archived evidence at this level. Try another component or part.')}</p></div>}
        </section>
      </>}

      <aside className="catalog-boundaries"><div className="section-eyebrow">{t('覆盖是可检查的过程', 'COVERAGE IS A VERIFIABLE PROCESS')}</div><h2>{t('向全覆盖推进，先把缺口标清。', 'Toward full coverage, make the gaps clear first.')}</h2><p>{t('“1w+、国内外覆盖”是建设目标，统计口径仍待确认。当前展示的是已有来源的索引与分层结果；GPT辅助整理的内容需经来源、机型与配置核验后入库。', '“10,000+ and domestic/international coverage” is a development target; the counting unit still needs confirmation. The browser shows source-backed archived records and hierarchy. AI-assisted drafts require source, model and configuration checks before inclusion.')}</p>{catalog?.limitations.length ? <ul>{catalog.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul> : null}</aside>
    </div>
  </div>;
}
