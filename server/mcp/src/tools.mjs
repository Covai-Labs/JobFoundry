import { z } from 'zod';
import {
  buildFitBreakdown,
  extractSkills,
  normalizeSearchStatus,
  normalizeStatus,
  summarizeExperience,
  summarizeJob,
} from './normalize.mjs';

const JOB_ID = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .describe('JobFoundry job id (letters, digits, underscore, hyphen).');

const STATUS_LIST = 'new, saved, tailored, applied, interview, offer, rejected, archived';

function textResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

function toToolError(err) {
  if (err?.status === 401) {
    return errorResult(
      'JobFoundry rejected the API key (401). Set JOBFOUNDRY_API_KEY or pass --api-key.'
    );
  }
  return errorResult(err?.message || 'Unexpected error while calling JobFoundry');
}

export function registerTools(server, client) {
  server.registerTool(
    'get_profile',
    {
      title: 'Get profile',
      description:
        "Retrieve the user's active master resume, flattened skill inventory, and work history.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const { resume: active } = await client.getActiveResume();
        if (!active) {
          return textResult({
            profile: null,
            resume: null,
            skills: [],
            experience: [],
            message: 'No active master resume found. Upload one in the JobFoundry dashboard.',
          });
        }
        return textResult({
          profile: {
            id: active.id,
            title: active.title,
            isActive: active.isActive,
            created_at: active.created_at,
            updated_at: active.updated_at,
          },
          resume: active.resume,
          skills: extractSkills(active.resume),
          experience: summarizeExperience(active.resume),
        });
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    'search_saved_jobs',
    {
      title: 'Search saved jobs',
      description:
        'Filter captured job postings by stage, company, source, minimum fit score, or text.',
      inputSchema: {
        status: z
          .string()
          .optional()
          .describe(`Application stage. Canonical values: ${STATUS_LIST}.`),
        company: z.string().max(200).optional().describe('Exact company name, case-insensitive.'),
        source: z.string().max(100).optional().describe('Capture source, e.g. greenhouse.'),
        min_score: z.number().int().min(0).max(100).optional().describe('Minimum fit score.'),
        search: z
          .string()
          .max(500)
          .optional()
          .describe('Text search across title, company, and JD.'),
        sort_by: z
          .enum(['fit_score', 'created_at', 'updated_at', 'title', 'company', 'status'])
          .default('updated_at'),
        order: z.enum(['asc', 'desc']).default('desc'),
        limit: z.number().int().min(1).max(200).default(25),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      let status;
      if (args.status !== undefined) {
        status = normalizeSearchStatus(args.status);
        if (!status) {
          return errorResult(`Unknown status "${args.status}". Use one of: ${STATUS_LIST}.`);
        }
      }
      try {
        const { jobs } = await client.listJobs({
          status,
          company: args.company?.trim() || undefined,
          source: args.source?.trim() || undefined,
          min_score: args.min_score,
          search: args.search?.trim() || undefined,
          sort_by: args.sort_by,
          order: args.order,
          limit: args.limit,
        });
        return textResult({ count: jobs.length, jobs: jobs.map(summarizeJob) });
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    'get_job_fit_score',
    {
      title: 'Get job fit score',
      description: 'Retrieve fit score details, strengths, and gap analysis for a saved job.',
      inputSchema: { job_id: JOB_ID },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const { job } = await client.getJob(args.job_id);
        const fit = buildFitBreakdown(job);
        const payload = { scored: fit.scored, job: summarizeJob(job) };
        if (fit.error) payload.error = fit.error;
        if (fit.breakdown) payload.breakdown = fit.breakdown;
        if (fit.raw_fit_notes) payload.raw_fit_notes = fit.raw_fit_notes;
        if (!fit.scored && !fit.error) {
          payload.message = 'This job has not been scored yet. Trigger scoring in the dashboard.';
        }
        return textResult(payload);
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    'generate_tailored_resume',
    {
      title: 'Generate tailored resume',
      description:
        'Run the truthful tailoring pipeline for a saved job and return artifact URLs. This can take several minutes.',
      inputSchema: {
        job_id: JOB_ID,
        timeout_seconds: z.number().int().min(30).max(1800).default(900),
      },
      annotations: { openWorldHint: false },
    },
    async (args) => {
      try {
        const result = await client.tailorJob(args.job_id, {
          timeoutMs: args.timeout_seconds * 1000,
        });
        if (result?.ok === false || typeof result?.tailored_resume_id !== 'string') {
          return errorResult(
            'JobFoundry did not confirm the tailoring result. Check the job in the dashboard before retrying.'
          );
        }
        return textResult({
          ok: true,
          tailored_resume_id: result.tailored_resume_id,
          job: summarizeJob(result.job),
          artifacts: {
            pdf: client.artifactUrl(args.job_id, 'resume.pdf'),
            json: client.artifactUrl(args.job_id, 'resume.json'),
            markdown: client.artifactUrl(args.job_id, 'resume.md'),
            plaintext: client.artifactUrl(args.job_id, 'resume.txt'),
          },
        });
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    'update_application_status',
    {
      title: 'Update application status',
      description:
        'Move an application across Kanban stages. Accepts canonical stages and common aliases.',
      inputSchema: {
        job_id: JOB_ID,
        status: z
          .string()
          .describe(
            `Stage to set. Canonical values: ${STATUS_LIST}. Aliases: discovered, interviewing, offered, declined, closed.`
          ),
      },
      annotations: { idempotentHint: true },
    },
    async (args) => {
      const status = normalizeStatus(args.status);
      if (!status) {
        return errorResult(
          `Unknown application status "${args.status}". Use one of: ${STATUS_LIST}.`
        );
      }
      try {
        const { job } = await client.updateJobStatus(args.job_id, status);
        return textResult({ ok: true, job_id: args.job_id, status, job: summarizeJob(job) });
      } catch (err) {
        return toToolError(err);
      }
    }
  );
}
