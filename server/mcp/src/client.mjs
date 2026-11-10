export class ApiError extends Error {
  constructor(message, { status = null, body = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function encodeId(id) {
  return encodeURIComponent(String(id));
}

export class JobFoundryClient {
  constructor({ baseUrl, apiKey = '', timeoutMs = 30000, fetchImpl = fetch }) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = 'GET', body, timeoutMs } = {}) {
    const effectiveTimeout = timeoutMs ?? this.timeoutMs;
    const headers = { Accept: 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(effectiveTimeout),
      });
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        const seconds = Math.round(effectiveTimeout / 1000);
        throw new ApiError(`Request to JobFoundry timed out after ${seconds}s`);
      }
      throw new ApiError(`Could not reach JobFoundry at ${this.baseUrl}: ${err.message}`);
    }

    const text = await response.text();
    let data = null;
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const message =
        data && typeof data.error === 'string'
          ? data.error
          : `JobFoundry API returned HTTP ${response.status}`;
      throw new ApiError(message, { status: response.status, body: text.slice(0, 500) });
    }

    if (text.trim() && data === null) {
      throw new ApiError('JobFoundry API returned a non-JSON response');
    }

    return data ?? {};
  }

  getActiveResume() {
    return this.request('/api/v1/resumes/active');
  }

  listJobs(params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      query.set(key, String(value));
    }
    const qs = query.toString();
    return this.request(`/api/v1/jobs${qs ? `?${qs}` : ''}`);
  }

  getJob(id) {
    return this.request(`/api/v1/jobs/${encodeId(id)}`);
  }

  tailorJob(id, { timeoutMs } = {}) {
    return this.request(`/api/v1/jobs/${encodeId(id)}/tailor`, {
      method: 'POST',
      timeoutMs,
    });
  }

  updateJobStatus(id, status) {
    return this.request(`/api/v1/jobs/${encodeId(id)}`, {
      method: 'PATCH',
      body: { status },
    });
  }

  artifactUrl(id, filename) {
    return `${this.baseUrl}/api/v1/jobs/${encodeId(id)}/artifacts/${encodeURIComponent(filename)}`;
  }
}
