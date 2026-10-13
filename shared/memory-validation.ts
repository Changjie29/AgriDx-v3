import type { DeviceProfile, MemoryMessage } from './memory';
export class MemoryError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function profileFrom(value: unknown): DeviceProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MemoryError(400, 'bad_request', '请提供设备档案');
  const input = value as Record<string, unknown>;
  const result = {} as DeviceProfile;
  for (const key of ['name', 'machineType', 'brand', 'model', 'notes'] as const) {
    const max = key === 'notes' ? 2000 : 100;
    if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > max)) {
      throw new MemoryError(400, 'bad_request', `设备档案字段格式错误（${key}）`);
    }
    result[key] = (input[key] as string | undefined)?.trim() || '';
  }
  if (!result.name) throw new MemoryError(400, 'bad_request', '请为设备命名，以区分不同车辆');
  const hours = input.hours;
  if (hours !== undefined && hours !== null && (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0 || hours > 1_000_000)) {
    throw new MemoryError(400, 'bad_request', '使用小时数须为有效的非负数');
  }
  result.hours = typeof hours === 'number' ? hours : null;
  return result;
}

/** Exact excerpts of older user reports; no model call and no inferred facts. */
export function summarizeReports(messages: readonly Pick<MemoryMessage, 'role' | 'content'>[]): string {
  const older = messages.slice(0, -10).filter((m) => m.role === 'user');
  const selected = older.length <= 12 ? older : [...older.slice(0, 2), ...older.slice(-10)];
  return selected.map((m) => `用户曾报告：${m.content.slice(0, 260)}${m.content.length > 260 ? '（节选）' : ''}`).join('\n').slice(0, 3500);
}

