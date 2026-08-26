import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Layers,
  Youtube,
  Tv,
  Flame,
  Check,
  Zap,
  Power,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  SourceChannel,
  DiscoveredChannel,
  ScheduleRule,
  ScheduledJobRun,
} from '@/types/api';

export const ScheduleManager: React.FC = () => {
  const { isAuthenticated } = useAuth();

  const [channels, setChannels] = useState<SourceChannel[]>([]);
  const [rules, setRules] = useState<ScheduleRule[]>([]);
  const [runs, setRuns] = useState<ScheduledJobRun[]>([]);
  const [selectedRuleIdForRuns, setSelectedRuleIdForRuns] = useState<number | null>(null);

  // Master Scheduler Engine State
  const [isSchedulerRunning, setIsSchedulerRunning] = useState(true);
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [nextRunTime, setNextRunTime] = useState<string | null>(null);
  const [isTogglingScheduler, setIsTogglingScheduler] = useState(false);
  const [isTriggeringAll, setIsTriggeringAll] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isTriggeringRuleId, setIsTriggeringRuleId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Discovery & Curated State
  const [searchQuery, setSearchQuery] = useState('');
  const [curatedChannels, setCuratedChannels] = useState<DiscoveredChannel[]>([]);
  const [discoveredChannels, setDiscoveredChannels] = useState<DiscoveredChannel[]>([]);
  const [isSearchingChannels, setIsSearchingChannels] = useState(false);
  const [addingChannelId, setAddingChannelId] = useState<string | null>(null);
  const [isBatchAdding, setIsBatchAdding] = useState(false);

  // Rule Form State
  const [ruleName, setRuleName] = useState('Daily Auto-Pilot Shorts');
  const [ruleFrequency, setRuleFrequency] = useState<'daily' | 'hourly' | 'weekly'>('daily');
  const [ruleTime, setRuleTime] = useState('14:00');
  const [ruleNumClips, setRuleNumClips] = useState(3);
  const [ruleCaptionStyle, setRuleCaptionStyle] = useState('tiktok_pop');
  const [rulePrivacy, setRulePrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const [ruleChannelIds, setRuleChannelIds] = useState<number[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [channelsRes, rulesRes, curatedRes, schedStatus] = await Promise.all([
        api.getSourceChannels(),
        api.getScheduleRules(),
        api.getCuratedChannels(),
        api.getSchedulerStatus(),
      ]);
      setChannels(channelsRes.channels || []);
      setRules(rulesRes.rules || []);
      setCuratedChannels(curatedRes.channels || []);
      setDiscoveredChannels(curatedRes.channels || []);
      setIsSchedulerRunning(schedStatus.is_running);
      setActiveJobsCount(schedStatus.jobs_count);
      setNextRunTime(schedStatus.next_run_time);

      if (rulesRes.rules?.length > 0) {
        const firstRuleId = rulesRes.rules[0].id;
        setSelectedRuleIdForRuns(firstRuleId);
        const runsRes = await api.getScheduleRuleRuns(firstRuleId);
        setRuns(runsRes.runs || []);
      }
    } catch (err: any) {
      console.error('Failed to load schedule data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleScheduler = async () => {
    setIsTogglingScheduler(true);
    try {
      if (isSchedulerRunning) {
        await api.pauseScheduler();
        setIsSchedulerRunning(false);
        setToastMessage('Auto-Pilot Scheduler paused. No scheduled cron jobs will trigger.');
      } else {
        await api.startScheduler();
        setIsSchedulerRunning(true);
        setToastMessage('🚀 Auto-Pilot Scheduler started & active! Background cron triggers are running.');
      }
      const status = await api.getSchedulerStatus();
      setIsSchedulerRunning(status.is_running);
      setActiveJobsCount(status.jobs_count);
      setNextRunTime(status.next_run_time);
    } catch (err: any) {
      alert(`Error toggling scheduler: ${err.message}`);
    } finally {
      setIsTogglingScheduler(false);
    }
  };

  const handleTriggerAllRules = async () => {
    setIsTriggeringAll(true);
    try {
      const res = await api.triggerAllScheduledRules();
      setToastMessage(res.message || 'Started full background automated run across all active rules!');
      setTimeout(() => {
        if (selectedRuleIdForRuns) {
          handleSelectRuleForRuns(selectedRuleIdForRuns);
        }
      }, 3000);
    } catch (err: any) {
      alert(`Failed to trigger all rules: ${err.message}`);
    } finally {
      setIsTriggeringAll(false);
    }
  };

  const handleSelectRuleForRuns = async (ruleId: number) => {
    setSelectedRuleIdForRuns(ruleId);
    try {
      const runsRes = await api.getScheduleRuleRuns(ruleId);
      setRuns(runsRes.runs || []);
    } catch (err) {
      console.error('Error fetching runs for rule:', err);
    }
  };

  const handleSearchChannels = async (queryToSearch: string) => {
    if (!queryToSearch.trim()) {
      setDiscoveredChannels(curatedChannels);
      return;
    }
    setIsSearchingChannels(true);
    try {
      const res = await api.discoverSourceChannels(queryToSearch);
      setDiscoveredChannels(res.channels || []);
    } catch (err) {
      console.error('Channel discovery error:', err);
    } finally {
      setIsSearchingChannels(false);
    }
  };

  const handleAddChannel = async (disc: DiscoveredChannel) => {
    setAddingChannelId(disc.channel_id);
    try {
      await api.addSourceChannel({
        channel_id: disc.channel_id,
        channel_title: disc.channel_title,
        channel_thumbnail: disc.channel_thumbnail,
        subscriber_count: disc.subscriber_count,
        video_count: disc.video_count,
      });
      setToastMessage(`Tracked '${disc.channel_title}' successfully!`);
      const channelsRes = await api.getSourceChannels();
      setChannels(channelsRes.channels || []);
    } catch (err: any) {
      alert(`Could not add channel: ${err.message}`);
    } finally {
      setAddingChannelId(null);
    }
  };

  const handleBatchTrackAllCurated = async () => {
    if (!confirm(`Track all ${curatedChannels.length} featured creator channels in your Auto-Pilot library?`)) return;
    setIsBatchAdding(true);
    try {
      await api.batchAddSourceChannels(
        curatedChannels.map((c) => ({
          channel_id: c.channel_id,
          channel_title: c.channel_title,
          channel_thumbnail: c.channel_thumbnail,
          subscriber_count: c.subscriber_count,
          video_count: c.video_count,
        }))
      );
      setToastMessage(`Successfully tracked all ${curatedChannels.length} featured creators!`);
      const channelsRes = await api.getSourceChannels();
      setChannels(channelsRes.channels || []);
      setIsDiscoverModalOpen(false);
    } catch (err: any) {
      alert(`Batch add failed: ${err.message}`);
    } finally {
      setIsBatchAdding(false);
    }
  };

  const handleDeleteChannel = async (channelId: number) => {
    if (!confirm('Remove this channel from tracked sources?')) return;
    try {
      await api.deleteSourceChannel(channelId);
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
    } catch (err: any) {
      alert(`Failed to delete channel: ${err.message}`);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<ScheduleRule> = {
        name: ruleName,
        frequency: ruleFrequency,
        run_at_time: ruleTime,
        num_clips_per_video: ruleNumClips,
        caption_style: ruleCaptionStyle,
        privacy_status: rulePrivacy,
        source_channel_ids: ruleChannelIds,
        is_active: true,
      };

      if (editingRuleId) {
        await api.updateScheduleRule(editingRuleId, payload);
      } else {
        await api.createScheduleRule(payload);
      }

      setIsRuleModalOpen(false);
      setEditingRuleId(null);
      const [rulesRes, statusRes] = await Promise.all([
        api.getScheduleRules(),
        api.getSchedulerStatus(),
      ]);
      setRules(rulesRes.rules || []);
      setIsSchedulerRunning(statusRes.is_running);
      setActiveJobsCount(statusRes.jobs_count);
      setNextRunTime(statusRes.next_run_time);
      setToastMessage('Schedule rule saved & registered with active background scheduler!');
    } catch (err: any) {
      alert(`Failed to save rule: ${err.message}`);
    }
  };

  const handleTriggerRunNow = async (ruleId: number) => {
    setIsTriggeringRuleId(ruleId);
    try {
      await api.runScheduleRuleNow(ruleId);
      setToastMessage('Unattended pipeline triggered in background! Check audit log below in ~60 seconds.');
      setTimeout(() => {
        handleSelectRuleForRuns(ruleId);
      }, 3000);
    } catch (err: any) {
      alert(`Run failed: ${err.message}`);
    } finally {
      setIsTriggeringRuleId(null);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Delete this automated schedule rule?')) return;
    try {
      await api.deleteScheduleRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      if (selectedRuleIdForRuns === ruleId) {
        setSelectedRuleIdForRuns(null);
        setRuns([]);
      }
    } catch (err: any) {
      alert(`Failed to delete rule: ${err.message}`);
    }
  };

  const isTracked = (channelId: string) => {
    return channels.some((c) => c.channel_id === channelId);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-2xl flex items-center justify-between text-xs text-primary shadow-glow-sm">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-primary hover:underline font-bold text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Banner with Master Scheduler Controls */}
      <div className="relative rounded-3xl overflow-hidden p-6 sm:p-8 border border-border-subtle bg-gradient-to-r from-surface-2 via-surface-1 to-surface-0 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/15 text-secondary border border-secondary/30 text-xs font-mono">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Auto-Pilot 2.0 • Zero-Human Publishing</span>
            </div>

            {/* Live Scheduler Engine Status Pill */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono font-bold ${
                isSchedulerRunning
                  ? 'bg-status-success/15 border-status-success/40 text-status-success'
                  : 'bg-status-warning/15 border-status-warning/40 text-status-warning'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isSchedulerRunning ? 'bg-status-success animate-ping' : 'bg-status-warning'
                }`}
              />
              <span>{isSchedulerRunning ? 'SCHEDULER ENGINE: RUNNING' : 'SCHEDULER ENGINE: PAUSED'}</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-foreground">
            Scheduled Auto-Publishing
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Monitor 98+ top verified creators & Creative Commons sources, automatically generate vertical clips with kinetic Whisper subtitles, and upload directly to your YouTube channel at scheduled times.
          </p>

          {nextRunTime && (
            <p className="text-xs font-mono text-primary flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Next Automated Trigger: {new Date(nextRunTime).toLocaleString()}</span>
            </p>
          )}
        </div>

        {/* Action Controls & Master Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {/* Master Start / Pause Scheduler Button */}
          <Button
            variant={isSchedulerRunning ? 'secondary' : 'primary'}
            size="lg"
            isLoading={isTogglingScheduler}
            onClick={handleToggleScheduler}
            className={`gap-2.5 font-bold shadow-lg text-xs font-mono uppercase tracking-wider ${
              !isSchedulerRunning
                ? 'bg-primary text-black shadow-glow-md hover:bg-primary-hover animate-pulse'
                : 'border-border-muted text-foreground'
            }`}
          >
            {isSchedulerRunning ? (
              <>
                <Pause className="w-4 h-4 text-status-warning fill-status-warning" />
                <span>Pause Scheduler</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-black fill-black" />
                <span>Start Scheduler</span>
              </>
            )}
          </Button>

          {/* Trigger All Rules Immediately */}
          <Button
            variant="outline"
            size="lg"
            isLoading={isTriggeringAll}
            onClick={handleTriggerAllRules}
            disabled={rules.length === 0}
            className="gap-2 text-xs font-mono font-bold"
            title="Execute all active rules in background immediately"
          >
            <Zap className="w-4 h-4 text-primary fill-primary" />
            <span>Run All Now</span>
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setEditingRuleId(null);
              setRuleChannelIds(channels.map((c) => c.id));
              setIsRuleModalOpen(true);
            }}
            className="gap-2 text-xs font-mono font-bold"
          >
            <Plus className="w-4 h-4 text-black" />
            <span>Create Auto-Rule</span>
          </Button>
        </div>
      </div>

      {/* Grid: Rules & Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Schedule Rules (Col 1 & 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Automated Schedule Rules ({rules.length})</span>
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadData}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground font-mono text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              Loading schedule rules...
            </div>
          ) : rules.length === 0 ? (
            <Card className="p-8 text-center space-y-4 border-dashed border-border-subtle bg-surface-1/50">
              <div className="w-12 h-12 rounded-2xl bg-surface-2 text-muted-foreground flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-sm font-bold text-foreground">No active schedule rules yet</h3>
                <p className="text-xs text-muted-foreground">
                  Create a rule to set automated daily clipping times and channel tracking.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setRuleChannelIds(channels.map((c) => c.id));
                  setIsRuleModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Create First Rule
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const isSelected = selectedRuleIdForRuns === rule.id;
                const isTriggering = isTriggeringRuleId === rule.id;

                return (
                  <Card
                    key={rule.id}
                    className={`p-5 space-y-4 transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-primary/60 bg-surface-2/90 shadow-glow-sm'
                        : 'hover:border-border-muted bg-surface-1'
                    }`}
                    onClick={() => handleSelectRuleForRuns(rule.id)}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground">{rule.name}</h3>
                          <Badge variant={rule.is_active ? 'success' : 'default'}>
                            {rule.is_active ? 'ACTIVE' : 'PAUSED'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 font-mono">
                          <span className="text-primary font-bold">
                            {rule.frequency.toUpperCase()} at {rule.run_at_time}
                          </span>
                          <span>•</span>
                          <span>{rule.num_clips_per_video} Clips / Video</span>
                          <span>•</span>
                          <span>Style: {rule.caption_style}</span>
                          <span>•</span>
                          <span className="capitalize">{rule.privacy_status}</span>
                        </p>
                      </div>

                      <div
                        className="flex items-center gap-2 w-full sm:w-auto justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="secondary"
                          size="sm"
                          isLoading={isTriggering}
                          onClick={() => handleTriggerRunNow(rule.id)}
                          className="text-xs font-mono gap-1"
                        >
                          <Play className="w-3 h-3 text-primary fill-primary" />
                          <span>Run Now</span>
                        </Button>

                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-surface-3 transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Tracked Channels Library (Col 3) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Tv className="w-4 h-4 text-secondary" />
              <span>Tracked Sources ({channels.length})</span>
            </h2>
            <button
              onClick={() => {
                setIsDiscoverModalOpen(true);
                setDiscoveredChannels(curatedChannels);
              }}
              className="text-xs text-primary hover:underline font-mono font-bold"
            >
              + Browse 98+
            </button>
          </div>

          <Card className="p-4 space-y-3 bg-surface-1">
            {channels.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-xs text-muted-foreground">No channels added yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDiscoverModalOpen(true)}
                  className="text-xs"
                >
                  <Search className="w-3 h-3" /> Browse 98+ Creators
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {channels.map((chan) => (
                  <div
                    key={chan.id}
                    className="p-3 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {chan.channel_thumbnail ? (
                        <img
                          src={chan.channel_thumbnail}
                          alt={chan.channel_title}
                          className="w-8 h-8 rounded-full border border-border-subtle object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
                          {chan.channel_title.slice(0, 1)}
                        </div>
                      )}
                      <div className="truncate">
                        <p className="font-bold text-foreground truncate">{chan.channel_title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {chan.subscriber_count || 'Verified Creator'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteChannel(chan.id)}
                      className="text-muted-foreground hover:text-red-400 p-1.5 rounded-lg hover:bg-surface-3 transition-colors"
                      title="Remove from tracking"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Audit Run Logs */}
      <div className="space-y-4 pt-4 border-t border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-status-success" />
              <span>Audit Execution Logs</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Traceable execution records and published YouTube Shorts URLs.
            </p>
          </div>
        </div>

        {runs.length === 0 ? (
          <Card className="p-8 text-center text-xs font-mono text-muted-foreground bg-surface-1/40">
            No execution runs recorded for this rule yet. Click "Run Now" to test immediately.
          </Card>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <Card key={run.id} className="p-4 space-y-3 bg-surface-1 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2.5">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-foreground">Run #{run.id}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      {run.triggered_at ? new Date(run.triggered_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>

                  <Badge
                    variant={
                      run.status === 'completed'
                        ? 'success'
                        : run.status === 'running'
                        ? 'primary'
                        : 'error'
                    }
                  >
                    {run.status.toUpperCase()}
                  </Badge>
                </div>

                {run.error_message && (
                  <p className="text-[11px] text-red-400 font-mono bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                    {run.error_message}
                  </p>
                )}

                {run.source_videos_processed?.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-mono text-muted-foreground uppercase">
                      Processed Videos:
                    </p>
                    {run.source_videos_processed.map((v, vIdx) => (
                      <div
                        key={vIdx}
                        className="p-3 bg-surface-2 rounded-xl border border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground text-xs">{v.title}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Channel: {v.channel_title || 'Creator'} (ID: {v.video_id})
                          </p>
                        </div>

                        {v.published_shorts && v.published_shorts.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {v.published_shorts.map((s, sIdx) => (
                              <a
                                key={sIdx}
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600/15 border border-red-500/30 text-red-400 rounded-lg text-[11px] font-mono font-bold hover:bg-red-600/25 transition-colors"
                              >
                                <Youtube className="w-3 h-3 text-red-500" />
                                <span>Short #{s.clip_id}</span>
                                <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            No clips uploaded
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground font-mono italic">
                    Pipeline completed without new video uploads.
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Discovery & Curated 98+ Creators Modal */}
      <Modal
        isOpen={isDiscoverModalOpen}
        onClose={() => setIsDiscoverModalOpen(false)}
        maxWidth="lg"
      >
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Flame className="w-4 h-4 text-primary" />
                <span>Featured Creators & CC Library ({curatedChannels.length} Channels)</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Track top global creators (MrBeast, PewDiePie, MKBHD) or paste any YouTube handle (@handle / URL).
              </p>
            </div>

            <Button
              size="sm"
              variant="primary"
              isLoading={isBatchAdding}
              onClick={handleBatchTrackAllCurated}
              className="text-xs shrink-0"
            >
              <Check className="w-3.5 h-3.5 text-black" />
              <span>Track All ({curatedChannels.length})</span>
            </Button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearchChannels(e.target.value);
              }}
              placeholder="Search creator name or paste @handle / YouTube channel URL..."
              className="flex-1 bg-surface-0 border border-border-subtle rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary"
            />
            <Button
              size="sm"
              isLoading={isSearchingChannels}
              onClick={() => handleSearchChannels(searchQuery)}
            >
              Search
            </Button>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {isSearchingChannels ? (
              <div className="text-center py-10 text-xs font-mono text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                Scanning YouTube channels...
              </div>
            ) : discoveredChannels.length === 0 ? (
              <div className="text-center py-8 text-xs font-mono text-muted-foreground">
                No channels found. Try another search query or handle.
              </div>
            ) : (
              discoveredChannels.map((d) => {
                const tracked = isTracked(d.channel_id);
                return (
                  <div
                    key={d.channel_id}
                    className="p-3.5 rounded-2xl bg-surface-2 border border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {d.channel_thumbnail ? (
                        <img
                          src={d.channel_thumbnail}
                          alt={d.channel_title}
                          className="w-10 h-10 rounded-full object-cover border border-border-subtle shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
                          {d.channel_title.slice(0, 1)}
                        </div>
                      )}
                      <div className="space-y-0.5 truncate">
                        <p className="font-bold text-foreground truncate">{d.channel_title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {d.subscriber_count} {d.video_count ? `• ${d.video_count}` : ''}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={tracked ? 'secondary' : 'outline'}
                      disabled={tracked}
                      isLoading={addingChannelId === d.channel_id}
                      onClick={() => handleAddChannel(d)}
                      className="shrink-0 text-xs font-mono"
                    >
                      {tracked ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
                          <span>Tracked</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Track</span>
                        </>
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Rule Config Modal */}
      <Modal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        maxWidth="md"
      >
        <form onSubmit={handleSaveRule} className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span>{editingRuleId ? 'Edit Schedule Rule' : 'Create Auto-Publish Rule'}</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Define frequency, time, and caption styling for automated clipping runs.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-mono text-muted-foreground mb-1">
                Rule Name
              </label>
              <input
                type="text"
                required
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full bg-surface-0 border border-border-subtle rounded-xl px-3.5 py-2 text-foreground outline-none focus:border-primary text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-muted-foreground mb-1">
                  Frequency
                </label>
                <select
                  value={ruleFrequency}
                  onChange={(e: any) => setRuleFrequency(e.target.value)}
                  className="w-full bg-surface-0 border border-border-subtle rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs"
                >
                  <option value="daily">Daily</option>
                  <option value="hourly">Hourly</option>
                  <option value="weekly">Weekly (Monday)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-muted-foreground mb-1">
                  Trigger Time (24h)
                </label>
                <input
                  type="time"
                  required
                  value={ruleTime}
                  onChange={(e) => setRuleTime(e.target.value)}
                  className="w-full bg-surface-0 border border-border-subtle rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-muted-foreground mb-1">
                  Clips Per Video
                </label>
                <select
                  value={ruleNumClips}
                  onChange={(e) => setRuleNumClips(Number(e.target.value))}
                  className="w-full bg-surface-0 border border-border-subtle rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs font-mono"
                >
                  <option value={1}>1 Short Clip</option>
                  <option value={2}>2 Short Clips</option>
                  <option value={3}>3 Short Clips (Recommended)</option>
                  <option value={5}>5 Short Clips</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-muted-foreground mb-1">
                  Caption Preset
                </label>
                <select
                  value={ruleCaptionStyle}
                  onChange={(e) => setRuleCaptionStyle(e.target.value)}
                  className="w-full bg-surface-0 border border-border-subtle rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs font-mono"
                >
                  <option value="tiktok_pop">TikTok Pop Style</option>
                  <option value="minimal">Minimal Clean</option>
                  <option value="bounce">Kinetic Bounce</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-muted-foreground mb-1">
                YouTube Shorts Privacy
              </label>
              <select
                value={rulePrivacy}
                onChange={(e: any) => setRulePrivacy(e.target.value)}
                className="w-full bg-surface-0 border border-border-subtle rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary text-xs font-mono"
              >
                <option value="public">Public (Instant Live)</option>
                <option value="unlisted">Unlisted (Link Only)</option>
                <option value="private">Private (Draft Mode)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsRuleModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save & Schedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
