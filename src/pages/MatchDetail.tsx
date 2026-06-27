import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Radio, Calendar, MapPin, Trophy, ArrowLeft, Loader2, Plus, Minus, Save } from 'lucide-react';
import { format } from 'date-fns';

interface Match {
  id: string;
  tournament_id: string;
  match_date: string;
  status: string;
  result_summary: string | null;
  overs_per_innings: number;
  team_a_id: string;
  team_b_id: string;
  winner_id: string | null;
  tournament: { id: string; name: string } | null;
  team_a: { id: string; name: string; short_name: string | null } | null;
  team_b: { id: string; name: string; short_name: string | null } | null;
  venue: { id: string; name: string; city: string } | null;
}

interface LiveScore {
  id: string;
  match_id: string;
  batting_team_id: string;
  runs: number;
  wickets: number;
  overs: number;
  target: number | null;
  innings: number;
  current_run_rate: number | null;
  required_run_rate: number | null;
  last_updated_at: string;
}

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [match, setMatch] = useState<Match | null>(null);
  const [score, setScore] = useState<LiveScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canScore, setCanScore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);

  // Scoring form state (local, applied with Save)
  const [draft, setDraft] = useState<{
    batting_team_id: string;
    runs: number;
    wickets: number;
    overs: number;
    target: string;
    innings: number;
    status: string;
  } | null>(null);

  const fetchMatch = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id, tournament_id, match_date, status, result_summary, overs_per_innings,
        team_a_id, team_b_id, winner_id,
        tournament:tournaments(id, name),
        team_a:teams!matches_team_a_id_fkey(id, name, short_name),
        team_b:teams!matches_team_b_id_fkey(id, name, short_name),
        venue:venues(id, name, city)
      `)
      .eq('id', id)
      .maybeSingle();

    if (!error && data) setMatch(data as any);
  }, [id]);

  const fetchScore = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('live_scores')
      .select('*')
      .eq('match_id', id)
      .maybeSingle();
    if (data) {
      setScore(data as LiveScore);
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    }
  }, [id]);

  const checkPermission = useCallback(async () => {
    if (!user || !match) return setCanScore(false);
    const { data } = await supabase.rpc('can_manage_tournament', {
      _tournament_id: match.tournament_id,
    });
    setCanScore(!!data);
  }, [user, match]);

  // Initial load
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchMatch(), fetchScore()]);
      setIsLoading(false);
    })();
  }, [fetchMatch, fetchScore]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Real-time subscriptions
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`match-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_scores', filter: `match_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setScore(null);
          } else {
            setScore(payload.new as LiveScore);
            setFlash(true);
            setTimeout(() => setFlash(false), 600);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
        () => {
          fetchMatch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchMatch]);

  // Seed scoring draft when entering edit mode / when score arrives
  useEffect(() => {
    if (!match) return;
    if (draft) return;
    setDraft({
      batting_team_id: score?.batting_team_id || match.team_a_id,
      runs: score?.runs ?? 0,
      wickets: score?.wickets ?? 0,
      overs: score?.overs ?? 0,
      target: score?.target?.toString() ?? '',
      innings: score?.innings ?? 1,
      status: match.status === 'scheduled' ? 'live' : match.status,
    });
  }, [match, score, draft]);

  const handleSaveScore = async () => {
    if (!match || !draft || !user) return;
    setSaving(true);

    const battingOvers = Number(draft.overs) || 0;
    const crr = battingOvers > 0 ? +(draft.runs / battingOvers).toFixed(2) : null;
    const target = draft.target ? parseInt(draft.target) : null;
    const remainingOvers = match.overs_per_innings - battingOvers;
    const rrr = target && remainingOvers > 0
      ? +((target - draft.runs) / remainingOvers).toFixed(2)
      : null;

    const payload = {
      match_id: match.id,
      batting_team_id: draft.batting_team_id,
      runs: draft.runs,
      wickets: draft.wickets,
      overs: battingOvers,
      target,
      innings: draft.innings,
      current_run_rate: crr,
      required_run_rate: rrr,
      updated_by: user.id,
      last_updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('live_scores')
      .upsert(payload, { onConflict: 'match_id' });

    if (error) {
      toast({ title: 'Failed to save score', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    // Also update match status if it changed
    if (draft.status !== match.status) {
      await supabase.from('matches').update({ status: draft.status }).eq('id', match.id);
    }

    setSaving(false);
    toast({ title: 'Score updated', description: 'All viewers now see the latest score.' });
  };

  const adjust = (field: 'runs' | 'wickets' | 'overs', delta: number) => {
    if (!draft) return;
    if (field === 'overs') {
      // Cricket overs use .1 .. .5 then increment integer
      let next = +(draft.overs + delta).toFixed(1);
      const intPart = Math.floor(next);
      const dec = +(next - intPart).toFixed(1);
      if (dec >= 0.6) next = intPart + 1;
      if (dec < 0) next = Math.max(0, intPart - 1 + 0.5);
      if (next < 0) next = 0;
      setDraft({ ...draft, overs: next });
    } else {
      const next = Math.max(0, draft[field] + delta);
      setDraft({ ...draft, [field]: next });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 max-w-4xl">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-48 w-full mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!match) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-3xl font-display mb-2">MATCH NOT FOUND</h1>
          <Button onClick={() => navigate('/matches')} className="mt-4">Back to Matches</Button>
        </div>
      </Layout>
    );
  }

  const battingTeam = score?.batting_team_id === match.team_b_id ? match.team_b : match.team_a;
  const bowlingTeam = score?.batting_team_id === match.team_b_id ? match.team_a : match.team_b;

  return (
    <Layout>
      <div className="container py-6 max-w-4xl">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/matches')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> All Matches
        </Button>

        {/* Match Header */}
        <Card className="border-0 shadow-md mb-6 overflow-hidden">
          <div className="bg-gradient-hero text-primary-foreground p-6">
            <div className="flex items-center justify-between mb-4">
              <Link 
                to={`/tournaments/${match.tournament_id}`}
                className="text-sm text-primary-foreground/80 hover:text-primary-foreground flex items-center gap-1"
              >
                <Trophy className="h-4 w-4" />
                {match.tournament?.name || 'Tournament'}
              </Link>
              {match.status === 'live' && (
                <Badge className="bg-live animate-pulse-live border-0">
                  <Radio className="h-3 w-3 mr-1" /> LIVE
                </Badge>
              )}
              {match.status === 'scheduled' && <Badge variant="secondary">Upcoming</Badge>}
              {match.status === 'completed' && <Badge variant="secondary">Completed</Badge>}
            </div>

            <div className="grid grid-cols-3 items-center gap-4">
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-display tracking-wide">
                  {match.team_a?.short_name || match.team_a?.name || 'TBA'}
                </p>
                {score && score.batting_team_id === match.team_a_id && (
                  <p className={`text-3xl md:text-4xl font-bold mt-2 transition-colors ${flash ? 'text-cricket-gold' : ''}`}>
                    {score.runs}/{score.wickets}
                    <span className="text-base font-normal ml-2 opacity-80">({score.overs})</span>
                  </p>
                )}
              </div>
              <div className="text-center text-xl font-display opacity-60">VS</div>
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-display tracking-wide">
                  {match.team_b?.short_name || match.team_b?.name || 'TBA'}
                </p>
                {score && score.batting_team_id === match.team_b_id && (
                  <p className={`text-3xl md:text-4xl font-bold mt-2 transition-colors ${flash ? 'text-cricket-gold' : ''}`}>
                    {score.runs}/{score.wickets}
                    <span className="text-base font-normal ml-2 opacity-80">({score.overs})</span>
                  </p>
                )}
              </div>
            </div>

            {match.result_summary && (
              <p className="text-center mt-4 font-medium">{match.result_summary}</p>
            )}
          </div>

          <CardContent className="p-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(match.match_date), 'EEE, MMM d, yyyy • h:mm a')}
            </div>
            {match.venue && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {match.venue.name}, {match.venue.city}
              </div>
            )}
            <div className="ml-auto text-xs">
              Innings {score?.innings || 1} • {match.overs_per_innings} overs
            </div>
          </CardContent>
        </Card>

        {/* Live Scorecard */}
        <Card className="border-0 shadow-md mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Live Scorecard</CardTitle>
              {match.status === 'live' && (
                <div className="flex items-center gap-2 text-sm text-live">
                  <span className="w-2 h-2 rounded-full bg-live animate-pulse-live" />
                  Updating in real-time
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {score ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Batting</p>
                  <p className="font-semibold mt-1">{battingTeam?.name}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Bowling</p>
                  <p className="font-semibold mt-1">{bowlingTeam?.name}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Run Rate</p>
                  <p className="font-semibold mt-1">{score.current_run_rate ?? '—'}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {score.target ? 'Req. Rate' : 'Target'}
                  </p>
                  <p className="font-semibold mt-1">
                    {score.target ? (score.required_run_rate ?? '—') : '—'}
                  </p>
                </div>
                {score.target && (
                  <div className="col-span-2 md:col-span-4 p-4 rounded-lg bg-accent/10 border border-accent/20">
                    <p className="text-sm">
                      <span className="font-semibold text-accent-foreground">Target: {score.target}</span>
                      {' • '}
                      Need {Math.max(0, score.target - score.runs)} runs from{' '}
                      {Math.max(0, Math.round((match.overs_per_innings - score.overs) * 6))} balls
                    </p>
                  </div>
                )}
                <p className="col-span-2 md:col-span-4 text-xs text-muted-foreground">
                  Last update: {format(new Date(score.last_updated_at), 'h:mm:ss a')}
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Radio className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No live score yet.</p>
                {canScore && <p className="text-sm mt-1">Use the controls below to start scoring.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scoring Controls (organizers/scorers only) */}
        {!canScore && user && (
          <Card className="border-0 shadow-md mb-6 border-l-4 border-l-muted">
            <CardContent className="py-4 text-sm text-muted-foreground">
              Only the tournament organizer (or invited co-scorers) can update this match's score.
            </CardContent>
          </Card>
        )}

        {canScore && draft && (
          <Card className="border-0 shadow-md border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" /> Scoring Controls
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Changes broadcast live to all viewers when you save.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Batting Team</Label>
                  <Select
                    value={draft.batting_team_id}
                    onValueChange={(v) => setDraft({ ...draft, batting_team_id: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={match.team_a_id}>{match.team_a?.name}</SelectItem>
                      <SelectItem value={match.team_b_id}>{match.team_b?.name}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Innings</Label>
                  <Select
                    value={String(draft.innings)}
                    onValueChange={(v) => setDraft({ ...draft, innings: parseInt(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1st Innings</SelectItem>
                      <SelectItem value="2">2nd Innings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreStepper
                  label="Runs"
                  value={draft.runs}
                  onIncrement={(d) => adjust('runs', d)}
                  steps={[1, 4, 6]}
                />
                <ScoreStepper
                  label="Wickets"
                  value={draft.wickets}
                  onIncrement={(d) => adjust('wickets', d)}
                  steps={[1]}
                  max={10}
                />
                <ScoreStepper
                  label="Overs"
                  value={draft.overs}
                  onIncrement={(d) => adjust('overs', d)}
                  steps={[0.1, 1]}
                  decimal
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target">Target (set for 2nd innings)</Label>
                  <Input
                    id="target"
                    type="number"
                    min={0}
                    value={draft.target}
                    placeholder="—"
                    onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Match Status</Label>
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setDraft({ ...draft, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="abandoned">Abandoned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleSaveScore}
                disabled={saving}
                className="w-full bg-gradient-hero hover:opacity-90 h-11"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Broadcasting...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Save & Broadcast</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function ScoreStepper({
  label,
  value,
  onIncrement,
  steps,
  max,
  decimal,
}: {
  label: string;
  value: number;
  onIncrement: (delta: number) => void;
  steps: number[];
  max?: number;
  decimal?: boolean;
}) {
  return (
    <div className="space-y-2 p-4 rounded-lg bg-muted/30">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <p className="text-3xl font-bold text-center">
        {decimal ? value.toFixed(1) : value}
      </p>
      <div className="flex gap-2 flex-wrap justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onIncrement(-steps[0])}
        >
          <Minus className="h-3 w-3" />
        </Button>
        {steps.map((s) => (
          <Button
            key={s}
            type="button"
            variant="secondary"
            size="sm"
            disabled={max !== undefined && value + s > max}
            onClick={() => onIncrement(s)}
          >
            <Plus className="h-3 w-3 mr-0.5" />
            {decimal ? s.toFixed(1) : s}
          </Button>
        ))}
      </div>
    </div>
  );
}
