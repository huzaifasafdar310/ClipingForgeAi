export interface VideoMetadata {
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  video_id: string;
  local?: boolean;
  filename?: string;
}

export type ClipStatus =
  | 'analyzed'
  | 'pending'
  | 'downloading'
  | 'processing'
  | 'uploading'
  | 'completed'
  | 'failed';

export type PrivacyStatus = 'public' | 'unlisted' | 'private';

export type CaptionStyle = 'tiktok_pop' | 'minimal' | 'bounce';

export interface Clip {
  id: number;
  clip_id_num: number;
  job_id: string | null;
  video_id: string;
  video_url: string;
  startTime: string;
  endTime: string;
  start_seconds: number;
  end_seconds: number;
  title: string;
  description: string;
  suggestedTags: string[];
  reasoning?: string;
  privacyStatus: PrivacyStatus;
  status: ClipStatus;
  error?: string | null;
  youtube_url?: string | null;
  transcript_fallback: boolean;
  has_captions: boolean;
  caption_style: CaptionStyle;
  caption_font: string;
  caption_color: string;
  caption_language: string;
  progress: number;
  file_path?: string;
  local_source?: boolean;
  source_file?: string;
}

export interface AnalyzeResponse {
  metadata: VideoMetadata;
  clips: Clip[];
  error?: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string | null;
  updated_at: string | null;
  error_message: string | null;
  results: Clip[];
}

export interface ProjectsResponse {
  clips: Clip[];
  stats: {
    total_clips: number;
    completed_clips: number;
    total_projects: number;
  };
  error?: string;
}

export interface UploadPayload {
  clips: Array<{
    id: number;
    privacyStatus?: PrivacyStatus;
    title?: string;
    description?: string;
  }>;
  access_token: string;
}

export interface SourceChannel {
  id: number;
  channel_id: string;
  channel_title: string;
  channel_thumbnail?: string;
  subscriber_count?: string;
  video_count?: string;
  added_by_user_id: string;
  license_filter: string;
  is_active: boolean;
  last_checked_at: string | null;
  created_at: string | null;
}

export interface DiscoveredChannel {
  channel_id: string;
  channel_title: string;
  channel_thumbnail: string;
  subscriber_count: string;
  video_count: string;
  sample_video_title: string;
  sample_video_id: string;
  license: string;
}

export interface ScheduleRule {
  id: number;
  user_id: string;
  name: string;
  source_channel_ids: number[];
  frequency: 'daily' | 'hourly' | 'weekly' | 'once';
  run_at_time: string;
  num_clips_per_video: number;
  max_videos_per_run: number;
  caption_style: string;
  caption_font: string;
  caption_color: string;
  privacy_status: PrivacyStatus;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string | null;
}

export interface ScheduledJobRun {
  id: number;
  schedule_rule_id: number;
  triggered_at: string | null;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  source_videos_processed: Array<{
    video_id: string;
    title: string;
    channel_title?: string;
    published_shorts?: Array<{ clip_id: number; title: string; url: string }>;
    errors?: string[];
  }>;
  error_message: string | null;
}
