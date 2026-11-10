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

function timeoutMessage(timeoutMs) {
  return `Request to JobFoundry timed out after ${Math.max(1, Math.round(timeoutMs / 1000))}s`;
}

function isTimeout(err) {
  return err?.name === 'TimeoutError' || err?.name === 'AbortError';
}

export class JobFoundryClient {
  constructor({ baseUrl, apiKey = '', timeoutMs = 30000, fetchImpl = fetch }) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  networkError(err, timeoutMs) {
    if (isTimeout(err)) return new ApiError(timeoutMessage(timeoutMs));
    if (/redirect/i.test(err?.cause?.message ?? '')) {
      return new ApiError(
        'JobFoundry redirected the request, but redirects are not followed. Point JOBFOUNDRY_URL at the final base URL.'
      );
    }
    const cause = err?.cause?.message ? `: ${err.cause.message}` : '';
    return new ApiError(`Could not reach JobFoundry at ${this.baseUrl}${cause}`);
  }

  errorMessage(data, text, status) {
    // JobFoundry's own handlers use `{ error: "human text" }`; Fastify and most
    // proxies add `message` alongside a machine-readable `error` code.
    if (data && typeof data.message === 'string' && data.message) return data.message;
    if (data && typeof data.error === 'string' && data.error) return data.error;
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 200);
    return `JobFoundry API returned HTTP ${status}${snippet ? `: ${snippet}` : ''}`;
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
      throw this.networkError(err, effectiveTimeout);
    }

    let text;
    try {
      text = await response.text();
    } catch (err) {
      throw this.networkError(err, effectiveTimeout);
    }

    let data = null;
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      throw new ApiError(this.errorMessage(data, text, response.status), {
        status: response.status,
        body: text.slice(0, 500),
      });
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
