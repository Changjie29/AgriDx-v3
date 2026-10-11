import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ChatProvider, FallbackReason } from '../../../shared/chat';
import { requestChat } from './api';
import {
  createChatRequest, generateMessageId, loadChatSession, MAX_QUESTION_LENGTH,
  saveHistory, saveMachineContext, type ChatMessage,
} from './session';

interface ChatSessionOptions {
  handoff: unknown;
  translate: (zh: string, en: string) => string;
  focusInput: () => void;
}

/** Owns conversation lifecycle; the page renders the workspace and input controls. */
export function useChatSession({ handoff, translate: t, focusInput }: ChatSessionOptions) {
  const [initial] = useState(() => loadChatSession(handoff));
  const [messages, setMessages] = useState(initial.messages);
  const [input, setInput] = useState(initial.draft);
  const [machineType, setMachineType] = useState(initial.context.machineType);
  const [brand, setBrand] = useState(initial.context.brand);
  const [model, setModel] = useState(initial.context.model);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState('');
  const [currentProvider, setCurrentProvider] = useState<ChatProvider | ''>('');
  const [currentFallbackReason, setCurrentFallbackReason] = useState<FallbackReason | undefined>();
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);
  useEffect(() => saveHistory(messages), [messages]);
  useEffect(() => saveMachineContext({ machineType, brand, model }), [machineType, brand, model]);

  const resetStatus = useCallback(() => {
    setCurrentModel('');
    setCurrentProvider('');
    setCurrentFallbackReason(undefined);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_QUESTION_LENGTH || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    // Leave time for sequential provider fallback and transport of the local answer.
    const timeout = window.setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), 60_000);
    const userMessage: ChatMessage = { id: generateMessageId(), role: 'user', content: trimmed };
    const loadingMessage: ChatMessage = { id: generateMessageId(), role: 'loading', content: '' };
    setMessages((previous) => [...previous, userMessage, loadingMessage]);
    setInput('');
    setIsLoading(true);
    try {
      const reply = await requestChat(
        createChatRequest(messages, trimmed, { machineType, brand, model }),
        controller.signal,
        t('智能诊断服务暂时无法连接，请稍后重试。', 'AI service unavailable, please try again later.'),
      );
      // Stop, clear or unmount can invalidate this request while its body is being read.
      if (requestRef.current !== controller) return;
      setCurrentModel(reply.model || '');
      setCurrentProvider(reply.provider || '');
      setCurrentFallbackReason(reply.fallbackReason);
      setMessages((previous) => previous.map((message) => message.id === loadingMessage.id
        ? { id: message.id, ...reply } : message));
    } catch {
      if (requestRef.current !== controller) return;
      resetStatus();
      setMessages((previous) => previous.map((message) => message.id === loadingMessage.id ? {
        id: message.id,
        role: 'error',
        content: t('对话请求未完成，请稍后重试；已有对话仍保留。', 'The chat request did not complete. Please retry; your previous messages are preserved.'),
      } : message));
      toast.error(t('对话服务暂不可用', 'Chat service unavailable'));
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsLoading(false);
        window.setTimeout(focusInput, 0);
      }
    }
  }, [messages, machineType, brand, model, t, focusInput, resetStatus]);

  const stopRequest = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setIsLoading(false);
    setMessages((previous) => previous.filter((message) => message.role !== 'loading'));
    focusInput();
  }, [focusInput]);

  const handleClear = useCallback(() => {
    stopRequest();
    resetStatus();
    setMessages([]);
    toast.success(t('对话已清空', 'Chat cleared'));
  }, [stopRequest, resetStatus, t]);

  return {
    messages, input, setInput, machineType, setMachineType, brand, setBrand, model, setModel,
    isLoading, currentModel, currentProvider, currentFallbackReason,
    sendMessage, stopRequest, handleClear,
  };
}
