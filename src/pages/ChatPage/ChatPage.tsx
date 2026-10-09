import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { Send, Trash2, Loader2, Bot, User, Sparkles, Cpu, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { LiquidGlass } from '@sohumsuthar/liquid-glass';
import { Link, useLocation } from 'react-router-dom';
import content, { pick } from '@/data/content';
import { useLang } from '@/hooks/useLang';

type ChatProvider = 'gemini' | 'deepseek' | 'knowledge-base';
type AnswerMode = 'knowledge-grounded' | 'general-guidance' | 'local-evidence';
type FallbackReason = 'not_configured' | 'provider_unavailable';

interface LlmHealth {
  configured: boolean;
  primary: 'gemini' | 'deepseek' | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error' | 'loading';
  content: string;
  model?: string;
  provider?: ChatProvider;
  answerMode?: AnswerMode;
  fallbackReason?: FallbackReason;
  knowledgeChunks?: number;
}

function isChatProvider(value: unknown): value is ChatProvider {
  return value === 'gemini' || value === 'deepseek' || value === 'knowledge-base';
}

function isAnswerMode(value: unknown): value is AnswerMode {
  return value === 'knowledge-grounded' || value === 'general-guidance' || value === 'local-evidence';
}

function isFallbackReason(value: unknown): value is FallbackReason {
  return value === 'not_configured' || value === 'provider_unavailable';
}

function isKnowledgeChunkCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

const STORAGE_KEY = '__app_srt27_chat_history';
const META_KEY = '__app_srt27_chat_meta';

// 农机类型选项（轻量，不强制）
const MACHINE_TYPES_ZH = ['拖拉机', '联合收割机', '插秧机', '植保机', '新能源农机', '无人农机', '其他'];
const MACHINE_TYPES_EN = ['Tractor', 'Combine', 'Transplanter', 'Sprayer', 'New-energy', 'Autonomous', 'Other'];

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadHistory(): ChatMessage[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    // 关闭页面时若正在请求，localStorage 里可能残留 loading/error 占位消息；恢复时丢弃
    return Array.isArray(parsed)
      ? parsed.filter((m): m is ChatMessage =>
          m !== null && typeof m === 'object' && typeof m.id === 'string' &&
          typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')
        ).slice(-100).map((m) => ({
          id: m.id, role: m.role, content: m.content,
          model: typeof m.model === 'string' ? m.model : undefined,
          provider: isChatProvider(m.provider) ? m.provider : undefined,
          answerMode: isAnswerMode(m.answerMode) ? m.answerMode : undefined,
          fallbackReason: isFallbackReason(m.fallbackReason) ? m.fallbackReason : undefined,
          knowledgeChunks: isKnowledgeChunkCount(m.knowledgeChunks) ? m.knowledgeChunks : undefined,
        }))
      : [];
  } catch {
    return [];
  }
}

function loadMeta(): { machineType: string; brand: string; model: string } {
  try {
    const meta = localStorage.getItem(META_KEY);
    if (!meta) return { machineType: '', brand: '', model: '' };
    const m = JSON.parse(meta);
    return {
      machineType: typeof m?.machineType === 'string' ? (MACHINE_TYPES_ZH[MACHINE_TYPES_EN.indexOf(m.machineType)] || m.machineType) : '',
      brand: typeof m?.brand === 'string' ? m.brand : '',
      model: typeof m?.model === 'string' ? m.model : '',
    };
  } catch {
    return { machineType: '', brand: '', model: '' };
  }
}

export default function ChatPage() {
  const location = useLocation();
  const handoff = location.state as { machineType?: unknown; brand?: unknown; model?: unknown; question?: unknown } | null;
  const lang = useLang();
  const t = useCallback((zh: string, en: string) => (lang === 'zh' ? zh : en), [lang]);
  const providerLabel = (provider?: ChatProvider) =>
    provider === 'knowledge-base' ? t('本地知识库', 'Local knowledge base') :
    provider === 'gemini' ? 'Gemini' : provider === 'deepseek' ? 'DeepSeek' : '';
  const answerModeLabel = (mode?: AnswerMode) =>
    mode === 'knowledge-grounded' ? t('知识库依据 + LLM', 'Knowledge-grounded LLM answer') :
    mode === 'general-guidance' ? t('LLM 通用建议 · 需核实', 'General LLM guidance · verify applicability') :
    mode === 'local-evidence' ? t('本地资料答复', 'Local evidence answer') : '';
  const fallbackLabel = (reason?: FallbackReason) =>
    reason === 'not_configured' ? t('LLM 未配置，仅使用本地资料', 'LLM not configured; using local evidence') :
    reason === 'provider_unavailable' ? t('模型服务暂不可用，已使用本地资料', 'Model service unavailable; using local evidence') : '';
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState(() => typeof handoff?.question === 'string' ? handoff.question.slice(0, 2000) : '');
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [currentProvider, setCurrentProvider] = useState<ChatProvider | ''>('');
  const [currentFallbackReason, setCurrentFallbackReason] = useState<FallbackReason | undefined>();
  const [llmHealth, setLlmHealth] = useState<LlmHealth | 'checking' | 'unknown'>('checking');
  const [machineType, setMachineType] = useState<string>(() => typeof handoff?.machineType === 'string' ? (MACHINE_TYPES_ZH.includes(handoff.machineType) ? handoff.machineType : '') : loadMeta().machineType);
  const [brand, setBrand] = useState<string>(() => typeof handoff?.brand === 'string' ? handoff.brand.slice(0, 100) : loadMeta().brand);
  const [model, setModel] = useState<string>(() => typeof handoff?.model === 'string' ? handoff.model.slice(0, 100) : loadMeta().model);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    let active = true;
    const checkConfiguration = async () => {
      try {
        const response = await fetch('/api/health', { signal: controller.signal });
        if (!response.ok) throw new Error('Health request failed');
        const data = await response.json();
        if (typeof data?.llm?.configured !== 'boolean') throw new Error('Unknown LLM configuration');
        if (active) {
          setLlmHealth({
            configured: data.llm.configured,
            primary: data.llm.primary === 'gemini' || data.llm.primary === 'deepseek' ? data.llm.primary : null,
          });
        }
      } catch {
        if (active) setLlmHealth('unknown');
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void checkConfiguration();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  // 保存历史
  useEffect(() => {
    try {
      if (messages.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-100)));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, [messages]);
  useEffect(() => {
    try {
      localStorage.setItem(META_KEY, JSON.stringify({ machineType, brand, model }));
    } catch { /* ignore */ }
  }, [machineType, brand, model]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 2000 || requestRef.current) return;
      const controller = new AbortController();
      requestRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), 60_000);

      const userMsg: ChatMessage = { id: generateId(), role: 'user', content: trimmed };
      const loadingMsg: ChatMessage = { id: generateId(), role: 'loading', content: '' };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      setInput('');
      setIsLoading(true);

      try {
        // 前端只发 user/assistant 历史；system prompt 由后端构造
        const historyForApi = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-20)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...historyForApi, { role: 'user' as const, content: trimmed }],
            machineType: machineType || undefined,
            brand: brand || undefined,
            model: model || undefined,
          }),
          // 留足双模型顺序回退及网络传输时间，避免提前中止后端的回退答复。
          signal: controller.signal,
        });

        let reply = '';
        let modelName = '';
        let provider: ChatProvider | '' = '';
        let answerMode: AnswerMode | undefined;
        let fallbackReason: FallbackReason | undefined;
        let knowledgeChunks: number | undefined;
        if (response.ok) {
          const data = await response.json();
          const result = data?.choices?.[0]?.message?.content;
          if (typeof result !== 'string' || !result.trim()) throw new Error('Empty response');
          reply = result;
          modelName = typeof data?.model === 'string' ? data.model : '';
          provider = isChatProvider(data?.provider) ? data.provider : '';
          answerMode = isAnswerMode(data?.answerMode) ? data.answerMode : undefined;
          fallbackReason = isFallbackReason(data?.fallbackReason) ? data.fallbackReason : undefined;
          knowledgeChunks = isKnowledgeChunkCount(data?.knowledgeChunks) ? data.knowledgeChunks : undefined;
        } else {
          // 后端已脱敏，统一友好文案
          const errData = await response.json().catch(() => null);
          reply = (typeof errData?.error === 'string' && errData.error) || t('智能诊断服务暂时无法连接，请稍后重试。', 'AI service unavailable, please try again later.');
        }

        if (requestRef.current !== controller) return;
        setCurrentModel(modelName);
        setCurrentProvider(provider);
        setCurrentFallbackReason(fallbackReason);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMsg.id
              ? {
                  ...m,
                  role: reply && response.ok ? ('assistant' as const) : ('error' as const),
                  content: reply,
                  model: modelName || undefined,
                  provider: provider || undefined,
                  answerMode,
                  fallbackReason,
                  knowledgeChunks,
                }
              : m,
          ),
        );
      } catch {
        if (requestRef.current !== controller) return;
        setCurrentModel('');
        setCurrentProvider('');
        setCurrentFallbackReason(undefined);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMsg.id
              ? {
                  ...m,
                  role: 'error' as const,
                  content: t('对话请求未完成，请稍后重试；已有对话仍保留。', 'The chat request did not complete. Please retry; your previous messages are preserved.'),
                }
              : m,
          ),
        );
        toast.error(t('对话服务暂不可用', 'Chat service unavailable'));
      } finally {
        window.clearTimeout(timeout);
        if (requestRef.current === controller) {
          requestRef.current = null;
          setIsLoading(false);
          setTimeout(() => textareaRef.current?.focus(), 0);
        }
      }
    },
    [messages, machineType, brand, model, t],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [input, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  const handleQuickQuestion = useCallback(
    (question: string) => {
      sendMessage(question);
    },
    [sendMessage],
  );

  const stopRequest = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setIsLoading(false);
    setMessages((prev) => prev.filter((m) => m.role !== 'loading'));
    textareaRef.current?.focus();
  }, []);

  const handleClear = useCallback(() => {
    stopRequest();
    setCurrentModel('');
    setCurrentProvider('');
    setCurrentFallbackReason(undefined);
    setMessages([]);
    setIsLoading(false);
    toast.success(t('对话已清空', 'Chat cleared'));
  }, [t, stopRequest]);

  const isEmpty = messages.length === 0;
  const typeOptions = lang === 'zh' ? MACHINE_TYPES_ZH : MACHINE_TYPES_EN;
  const serviceStatus = currentFallbackReason === 'provider_unavailable'
    ? t('本地知识库 · LLM 暂不可用', 'Local KB · LLM temporarily unavailable')
    : currentFallbackReason === 'not_configured'
    ? t('本地知识库 · LLM 未配置', 'Local KB · LLM not configured')
    : currentProvider === 'gemini' || currentProvider === 'deepseek'
    ? t('本地知识库 + LLM', 'Local KB + LLM')
    : typeof llmHealth === 'object' && !llmHealth.configured
    ? t('本地知识库 · LLM 未配置', 'Local KB · LLM not configured')
    : typeof llmHealth === 'object' && llmHealth.configured
    ? t('本地知识库 + LLM（已配置）', 'Local KB + LLM (configured)')
    : llmHealth === 'checking'
    ? t('本地知识库 · 正在检查 LLM 配置', 'Local KB · checking LLM configuration')
    : t('本地知识库 · LLM 配置状态未知', 'Local KB · LLM configuration unknown');
  const configurationHint = typeof llmHealth === 'object' && llmHealth.configured
    ? `${llmHealth.primary ? `${t('首选模型', 'Preferred provider')}: ${providerLabel(llmHealth.primary)}. ` : ''}${t('已配置密钥；服务可用性以实际对话结果为准。', 'An API key is configured; availability is determined by actual chat requests.')}`
    : undefined;

  return (
    <div className="flex h-[calc(100dvh-5.625rem)] flex-col chat-glass">
      {/* 顶部工具栏 */}
      <LiquidGlass
        variant="regular"
        interactive
        className="chat-bar-glass"
        contentClassName="flex items-center justify-between border-b border-border/60 px-4 py-3 md:px-6"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">耕知·耘诊 · {t('诊断工作台', 'Diagnosis workspace')}</div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" role="status">
              <span title={configurationHint}>{serviceStatus}</span>
              {currentProvider && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-accent/60 px-1.5 py-0.5 text-[11px] text-foreground">
                  <Cpu className="h-3 w-3 text-primary" />
                  {providerLabel(currentProvider)}
                </span>
              )}
              {currentModel && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border/60 bg-accent/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  {currentModel}
                </span>
              )}
            </div>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1.5 shrink-0" aria-label={t('清空对话', 'Clear conversation')} disabled={isEmpty}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('清空对话', 'Clear')}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('确认清空对话？', 'Clear all messages?')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('清空后当前所有对话记录将被删除，且无法恢复。', 'All current messages will be deleted and cannot be recovered.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('取消', 'Cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleClear}>{t('确认清空', 'Clear')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </LiquidGlass>

      {/* 消息列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto" role="log" aria-label={t('诊断对话', 'Diagnosis conversation')} aria-live="polite">
        <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
              {/* 农机信息选择（可选） */}
              <div className="mb-6 w-full rounded-xl border border-border/60 bg-card p-4 text-left">
                <div className="mb-3 flex items-center justify-between gap-3 text-xs font-medium text-primary"><span>{t('诊断上下文 · 请核对现场铭牌', 'Machine context · check the machine plate')}</span><Link to="/knowledge" className="underline underline-offset-4">{t('浏览适用资料', 'Browse evidence')}</Link></div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <select
                    aria-label={t('农机类型', 'Machine type')}
                    value={machineType}
                    onChange={(e) => setMachineType(e.target.value)}
                    disabled={isLoading}
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60"
                  >
                    <option value="">{t('类型', 'Type')}</option>
                    {typeOptions.map((v, index) => (
                      <option key={MACHINE_TYPES_ZH[index]} value={MACHINE_TYPES_ZH[index]}>{v}</option>
                    ))}
                  </select>
                  <input
                    aria-label={t('品牌', 'Brand')}
                    maxLength={100}
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder={t('品牌（选填）', 'Brand (optional)')}
                    disabled={isLoading}
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60"
                  />
                  <input
                    aria-label={t('型号', 'Model')}
                    maxLength={100}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={t('型号（选填）', 'Model (optional)')}
                    disabled={isLoading}
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60"
                  />
                </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('完整型号与配置帮助限定资料范围；系列资料不能直接代替具体机型。带入的问题仅预填，由你确认后发送。', 'The complete model and configuration define applicability. Series documents do not replace specific-model evidence. Imported questions are drafts for you to review and send.')}</p>
              </div>

          {/* 空状态 / 欢迎态 */}
          {isEmpty && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-xl font-bold text-foreground">{pick(content.CHAT_WELCOME.title, lang)}</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{pick(content.CHAT_WELCOME.desc, lang)}</p>


              {/* 快捷提问按钮 */}
              <div className="mt-6 w-full">
                <div className="mb-3 text-xs font-medium text-wheat">{t('您可以这样问', 'Try asking')}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {content.CHAT_QUICK_QUESTIONS.map((q) => (
                    <button
                      key={pick(q, lang)}
                      onClick={() => handleQuickQuestion(pick(q, lang))}
                      disabled={isLoading}
                      className="rounded-md border border-border/60 bg-card p-3 text-left text-sm text-foreground transition-all hover:border-primary/40 hover:bg-accent/50 hover:text-primary disabled:opacity-50"
                    >
                      {pick(q, lang)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 消息列表 */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role !== 'user' && (
                <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`min-w-0 break-words max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[75%] ${
                  msg.role === 'user'
                    ? 'rounded-tr-sm bg-primary text-primary-foreground'
                    : msg.role === 'error'
                    ? 'rounded-tl-sm border border-destructive/30 bg-destructive/5 text-destructive'
                    : msg.role === 'loading'
                    ? 'rounded-tl-sm border border-border/60 bg-card text-muted-foreground'
                    : 'rounded-tl-sm border border-border/60 bg-card text-foreground'
                }`}
              >
                {msg.role === 'loading' ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('正在思考...', 'Thinking...')}</span>
                  </div>
                ) : msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <div className="prose prose-sm max-w-none overflow-x-auto dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    {msg.role === 'assistant' && (msg.model || msg.provider || msg.answerMode || msg.fallbackReason || msg.knowledgeChunks !== undefined) && (
                      <div className="mt-2 border-t border-border/40 pt-2 text-[11px] leading-relaxed text-muted-foreground">
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                          {msg.answerMode && <span>{answerModeLabel(msg.answerMode)}</span>}
                          {msg.knowledgeChunks !== undefined && <span>{t(`知识库命中 ${msg.knowledgeChunks} 条`, `${msg.knowledgeChunks} knowledge snippets retrieved`)}</span>}
                          {(msg.model || msg.provider) && <span>{[providerLabel(msg.provider), msg.model].filter(Boolean).join(' · ')}</span>}
                        </div>
                        {msg.fallbackReason && <div className="mt-1">{fallbackLabel(msg.fallbackReason)}</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="ml-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/80 text-primary-foreground">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区 */}
      <LiquidGlass
        variant="regular"
        interactive
        className="chat-input-glass"
        contentClassName="border-t border-border/60 px-4 py-4 md:px-6"
      >
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2">
            <Textarea
              aria-label={t('故障描述', 'Fault description')}
              aria-describedby="chat-input-help"
              aria-invalid={input.trim().length > 2000}
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('描述您遇到的农机故障现象...', 'Describe the fault symptom...')}
              className="min-h-[60px] resize-none"
              rows={2}
              disabled={isLoading}
            />
            {isLoading ? (
              <Button type="button" size="icon" onClick={stopRequest} aria-label={t('停止等待', 'Stop waiting')} title={t('停止等待', 'Stop waiting')}>
                <Square className="h-4 w-4" />
              </Button>
            ) : <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || input.trim().length > 2000}
              className="shrink-0"
              aria-label={t('发送', 'Send')}
            >
              <Send className="h-4 w-4" />
            </Button>}
          </div>
          <div id="chat-input-help" className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground">
            <span>{t('按 Enter 发送，Shift + Enter 换行', 'Enter to send, Shift+Enter for newline')}</span>
            <span className={input.trim().length > 2000 ? 'text-destructive' : ''}>{input.trim().length} / 2000</span>
          </div>
        </form>
      </LiquidGlass>
    </div>
  );
}
