import {
  AnalyzeResponse,
  Clip,
  JobStatusResponse,
  ProjectsResponse,
  UploadPayload,
  SourceChannel,
  DiscoveredChannel,
  ScheduleRule,
  ScheduledJobRun,
} from '@/types/api';

const API_BASE = '/api';

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  let data: any;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${res.status}`;
    throw new ApiError(errorMsg, res.status);
  }

  return data as T;
}

export const api = {
  async analyzeYoutubeUrl(url: string, numClips: number = 3): Promise<AnalyzeResponse> {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, num_clips: numClips }),
    });
    return handleResponse<AnalyzeResponse>(res);
  },

  async analyzeLocalVideo(file: File, numClips: number = 3, title?: string): Promise<AnalyzeResponse> {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('num_clips', String(numClips));
    if (title) formData.append('title', title);

    const res = await fetch(`${API_BASE}/analyze-local`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<AnalyzeResponse>(res);
  },

  async startUploadJob(clips: Clip[], accessToken: string): Promise<{ job_id: string }> {
    const payload: UploadPayload = {
      clips: clips.map((c) => ({
        id: c.id,
        privacyStatus: c.privacyStatus,
        title: c.title,
        description: c.description,
      })),
      access_token: accessToken,
    };

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ job_id: string }>(res);
  },

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const res = await fetch(`${API_BASE}/status/${jobId}`);
    return handleResponse<JobStatusResponse>(res);
  },

  async updateClipCaptionStyle(
    clipId: number,
    data: {
      caption_style?: string;
      caption_font?: string;
      caption_color?: string;
      caption_language?: string;
      has_captions?: boolean;
    }
  ): Promise<{ message: string; clip: Clip }> {
    const res = await fetch(`${API_BASE}/clip/${clipId}/caption-style`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ message: string; clip: Clip }>(res);
  },

  async getProjects(): Promise<ProjectsResponse> {
    const res = await fetch(`${API_BASE}/projects`);
    return handleResponse<ProjectsResponse>(res);
  },

  async triggerCleanup(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/admin/cleanup`, {
      method: 'POST',
    });
    return handleResponse<{ message: string }>(res);
  },

  async getCurrentUser(): Promise<{ is_authenticated: boolean; user?: any; access_token?: string }> {
    const res = await fetch(`${API_BASE}/auth/me`);
    return handleResponse<{ is_authenticated: boolean; user?: any; access_token?: string }>(res);
  },

  async loginUser(data: {
    access_token: string;
    refresh_token?: string;
    name?: string;
    email?: string;
    picture?: string;
    expires_in?: number;
  }): Promise<{ success: boolean; user: any; access_token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean; user: any; access_token: string }>(res);
  },

  async logoutUser(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
    });
    return handleResponse<{ message: string }>(res);
  },

  async deleteClip(clipId: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/clip/${clipId}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // ==========================================
  // Scheduled Auto-Publishing API Clients
  // ==========================================

  async getCuratedChannels(): Promise<{ channels: DiscoveredChannel[]; total: number }> {
    const res = await fetch(`${API_BASE}/source-channels/curated`);
    return handleResponse<{ channels: DiscoveredChannel[]; total: number }>(res);
  },

  async batchAddSourceChannels(channels: Partial<SourceChannel>[]): Promise<{ success: boolean; added_count: number }> {
    const res = await fetch(`${API_BASE}/source-channels/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels }),
    });
    return handleResponse<{ success: boolean; added_count: number }>(res);
  },

  async discoverSourceChannels(query: string = 'technology podcast'): Promise<{ channels: DiscoveredChannel[]; query: string }> {
    const res = await fetch(`${API_BASE}/source-channels/discover?query=${encodeURIComponent(query)}`);
    return handleResponse<{ channels: DiscoveredChannel[]; query: string }>(res);
  },

  async getSourceChannels(): Promise<{ channels: SourceChannel[] }> {
    const res = await fetch(`${API_BASE}/source-channels`);
    return handleResponse<{ channels: SourceChannel[] }>(res);
  },

  async addSourceChannel(data: Partial<SourceChannel>): Promise<{ success: boolean; channel: SourceChannel }> {
    const res = await fetch(`${API_BASE}/source-channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean; channel: SourceChannel }>(res);
  },

  async deleteSourceChannel(channelId: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/source-channels/${channelId}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  async getScheduleRules(): Promise<{ rules: ScheduleRule[] }> {
    const res = await fetch(`${API_BASE}/schedule-rules`);
    return handleResponse<{ rules: ScheduleRule[] }>(res);
  },

  async createScheduleRule(rule: Partial<ScheduleRule>): Promise<{ success: boolean; rule: ScheduleRule }> {
    const res = await fetch(`${API_BASE}/schedule-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    return handleResponse<{ success: boolean; rule: ScheduleRule }>(res);
  },

  async updateScheduleRule(ruleId: number, rule: Partial<ScheduleRule>): Promise<{ success: boolean; rule: ScheduleRule }> {
    const res = await fetch(`${API_BASE}/schedule-rules/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    return handleResponse<{ success: boolean; rule: ScheduleRule }>(res);
  },

  async deleteScheduleRule(ruleId: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/schedule-rules/${ruleId}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  async runScheduleRuleNow(ruleId: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/schedule-rules/${ruleId}/run-now`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  async getScheduleRuleRuns(ruleId: number): Promise<{ runs: ScheduledJobRun[] }> {
    const res = await fetch(`${API_BASE}/schedule-rules/${ruleId}/runs`);
    return handleResponse<{ runs: ScheduledJobRun[] }>(res);
  },

  async getSchedulerStatus(): Promise<{ is_running: boolean; state: string; jobs_count: number; next_run_time: string | null; active_jobs: any[] }> {
    const res = await fetch(`${API_BASE}/scheduler/status`);
    return handleResponse<{ is_running: boolean; state: string; jobs_count: number; next_run_time: string | null; active_jobs: any[] }>(res);
  },

  async startScheduler(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/scheduler/start`, { method: 'POST' });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  async pauseScheduler(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/scheduler/pause`, { method: 'POST' });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  async triggerAllScheduledRules(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/scheduler/trigger-all`, { method: 'POST' });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  getClipDownloadUrl(clipId: number): string {
    return `${API_BASE}/download/${clipId}`;
  },

  getClipStreamUrl(filePathOrName: string): string {
    const basename = filePathOrName.replace(/^local:/, '').split(/[\\/]/).pop();
    return `/clips/${basename}`;
  },
};
