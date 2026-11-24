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
    return { ...DEFAULT_SCAN_STATE, ...stored };
  } catch {
    return { ...inMemoryScanState };
  }
}

export async function setScanState(
  patch: Partial<ScanState>,
  opts: { storageImpl?: any } = {}
): Promise<ScanState> {
  const current = await getScanState(opts);
  const updated: ScanState = { ...current, ...patch };
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
      callback({ ...DEFAULT_SCAN_STATE, ...changes[SCAN_STATE_KEY].newValue });
    }
  };

  storage.addListener(listener);
  return () => {
    try {
      storage.removeListener(listener);
    } catch {}
  };
}
