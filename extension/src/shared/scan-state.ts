export interface ScanState {
  inProgress: boolean;
  type: 'search' | 'scan' | 'capture' | null;
  statusMessage: string;
  termsSearched?: string[];
  currentTerm?: string;
  totalFound?: number;
  newIngested?: number;
  droppedDedup?: number;
  errors?: string[];
  startedAt?: number;
  completedAt?: number;
}

export const DEFAULT_SCAN_STATE: ScanState = {
  inProgress: false,
  type: null,
  statusMessage: 'Ready',
  totalFound: 0,
  newIngested: 0,
  droppedDedup: 0,
  errors: [],
};

const SCAN_STATE_KEY = 'jobfoundry-scan-state';

let inMemoryScanState: ScanState = { ...DEFAULT_SCAN_STATE };

export function sanitizeScanState(raw: unknown): ScanState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SCAN_STATE };
  }
  const obj = raw as Record<string, unknown>;
  const rawType = obj.type;
  const validType: ScanState['type'] =
    rawType === 'search' || rawType === 'scan' || rawType === 'capture' ? rawType : null;

  const isStale =
    Boolean(obj.inProgress) &&
    typeof obj.startedAt === 'number' &&
    Number.isFinite(obj.startedAt) &&
    Date.now() - obj.startedAt > 5 * 60 * 1000;

  const inProgress = isStale ? false : Boolean(obj.inProgress);
  const statusMessage = isStale
    ? 'Previous operation timed out or was interrupted.'
    : typeof obj.statusMessage === 'string' && obj.statusMessage.trim()
      ? obj.statusMessage
      : DEFAULT_SCAN_STATE.statusMessage;

  return {
    inProgress,
    type: validType,
    statusMessage,
    termsSearched: Array.isArray(obj.termsSearched)
      ? obj.termsSearched.filter((t): t is string => typeof t === 'string')
      : undefined,
    currentTerm: typeof obj.currentTerm === 'string' ? obj.currentTerm : undefined,
    totalFound:
      typeof obj.totalFound === 'number' && Number.isFinite(obj.totalFound)
        ? Math.max(0, obj.totalFound)
        : 0,
    newIngested:
      typeof obj.newIngested === 'number' && Number.isFinite(obj.newIngested)
        ? Math.max(0, obj.newIngested)
        : 0,
    droppedDedup:
      typeof obj.droppedDedup === 'number' && Number.isFinite(obj.droppedDedup)
        ? Math.max(0, obj.droppedDedup)
        : 0,
    errors: Array.isArray(obj.errors)
      ? obj.errors.filter((e): e is string => typeof e === 'string')
      : [],
    startedAt:
      typeof obj.startedAt === 'number' && Number.isFinite(obj.startedAt)
        ? obj.startedAt
        : undefined,
    completedAt:
      typeof obj.completedAt === 'number' && Number.isFinite(obj.completedAt)
        ? obj.completedAt
        : undefined,
  };
}

function getStorageArea(): any {
  const api = (globalThis as any).browser ?? (globalThis as any).chrome;
  return api?.storage?.local ?? api?.storage?.sync ?? null;
}

export async function getScanState(opts: { storageImpl?: any } = {}): Promise<ScanState> {
  const storage = opts.storageImpl ?? getStorageArea();
  if (!storage) return { ...inMemoryScanState };

  try {
    const res = await storage.get(SCAN_STATE_KEY);
    const stored = res?.[SCAN_STATE_KEY] ?? res ?? {};
    return sanitizeScanState(stored);
  } catch {
    return { ...inMemoryScanState };
  }
}

export async function setScanState(
  patch: Partial<ScanState>,
  opts: { storageImpl?: any } = {}
): Promise<ScanState> {
  const current = await getScanState(opts);
  const updated = sanitizeScanState({ ...current, ...patch });
  inMemoryScanState = updated;

  const storage = opts.storageImpl ?? getStorageArea();
  if (storage) {
    try {
      await storage.set({ [SCAN_STATE_KEY]: updated });
    } catch {
      // storage error fallback to in-memory
    }
  }

  return updated;
}

export async function resetScanState(opts: { storageImpl?: any } = {}): Promise<ScanState> {
  return setScanState(
    {
      inProgress: false,
      type: null,
      statusMessage: 'Ready',
      currentTerm: undefined,
    },
    opts
  );
}

export function watchScanState(
  callback: (state: ScanState) => void,
  opts: { storageImpl?: any } = {}
): () => void {
  const api = (globalThis as any).browser ?? (globalThis as any).chrome;
  const storage = opts.storageImpl ?? api?.storage?.onChanged;
  if (!storage?.addListener) return () => {};

  const listener = (changes: any, areaName?: string) => {
    if (areaName && areaName !== 'local' && areaName !== 'sync') return;
    if (changes[SCAN_STATE_KEY]?.newValue) {
      callback(sanitizeScanState(changes[SCAN_STATE_KEY].newValue));
    }
  };

  storage.addListener(listener);
  return () => {
    try {
      storage.removeListener(listener);
    } catch {}
  };
}
