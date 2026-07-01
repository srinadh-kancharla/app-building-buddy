import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Radio, Calendar, MapPin, Trophy, ArrowLeft, Pencil, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import BallByBallScorer from '@/components/scoring/BallByBallScorer';
import Scorecard from '@/components/scoring/Scorecard';
import { BallRow, PlayerLite } from '@/lib/scorecard';

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

  const [match, setMatch] = useState<Match | null>(null);
  const [score, setScore] = useState<LiveScore | null>(null);
  const [balls, setBalls] = useState<BallRow[]>([]);
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canScore, setCanScore] = useState(false);
  const [flash, setFlash] = useState(false);
  const [scoringInnings, setScoringInnings] = useState<number>(1);
  const [scoringBatting, setScoringBatting] = useState<string>('');

  const fetchMatch = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('matches')
      .select(`
        id, tournament_id, match_date, status, result_summary, overs_per_innings,
        team_a_id, team_b_id, winner_id,
        tournament:tournaments(id, name),
        team_a:teams!matches_team_a_id_fkey(id, name, short_name),
        team_b:teams!matches_team_b_id_fkey(id, name, short_name),
        venue:venues(id, name, city)
      `)
      .eq('id', id).maybeSingle();
    if (data) setMatch(data as any);
  }, [id]);

  const fetchScore = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('live_scores').select('*').eq('match_id', id).maybeSingle();
    if (data) {
      setScore(data as LiveScore);
      setFlash(true); setTimeout(() => setFlash(false), 600);
    }
  }, [id]);

  const fetchBalls = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('balls').select('*').eq('match_id', id).order('created_at', { ascending: true });
    if (data) setBalls(data as BallRow[]);
  }, [id]);

  const fetchPlayers = useCallback(async () => {
    if (!match) return;
    const { data } = await supabase.from('players').select('id, name, team_id')
      .in('team_id', [match.team_a_id, match.team_b_id]);
    if (data) setPlayers(data as PlayerLite[]);
  }, [match]);

  const checkPermission = useCallback(async () => {
    if (!user || !match) return setCanScore(false);
    const { data } = await supabase.rpc('can_manage_tournament', { _tournament_id: match.tournament_id });
    setCanScore(!!data);
  }, [user, match]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchMatch(), fetchScore(), fetchBalls()]);
      setIsLoading(false);
    })();
  }, [fetchMatch, fetchScore, fetchBalls]);

  useEffect(() => { fetchPlayers(); checkPermission(); }, [fetchPlayers, checkPermission]);

  // Seed scoring innings/batting from existing data
  useEffect(() => {
    if (!match) return;
    if (score) {
      setScoringInnings(score.innings || 1);
      setScoringBatting(score.batting_team_id || match.team_a_id);
    } else {
      setScoringBatting((prev) => prev || match.team_a_id);
    }
  }, [match, score]);

  // Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`match-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_scores', filter: `match_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setScore(null);
          else { setScore(payload.new as LiveScore); setFlash(true); setTimeout(() => setFlash(false), 600); }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'balls', filter: `match_id=eq.${id}` },
        () => fetchBalls())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' },
        () => fetchPlayers())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
        () => fetchMatch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, fetchBalls, fetchMatch, fetchPlayers]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 max-w-5xl">
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

  const battingTeamName = scoringBatting === match.team_b_id
    ? (match.team_b?.name || 'Team B')
    : (match.team_a?.name || 'Team A');
  const bowlingTeamId = scoringBatting === match.team_b_id ? match.team_a_id : match.team_b_id;
  const bowlingTeamName = scoringBatting === match.team_b_id
    ? (match.team_a?.name || 'Team A')
    : (match.team_b?.name || 'Team B');

  return (
    <Layout>
      <div className="container py-6 max-w-5xl">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/matches')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> All Matches
        </Button>

        {/* Match Header */}
        <Card className="border-0 shadow-md mb-6 overflow-hidden">
          <div className="bg-gradient-hero text-primary-foreground p-6">
            <div className="flex items-center justify-between mb-4">
              <Link to={`/tournaments/${match.tournament_id}`} className="text-sm text-primary-foreground/80 hover:text-primary-foreground flex items-center gap-1">
                <Trophy className="h-4 w-4" /> {match.tournament?.name || 'Tournament'}
              </Link>
              {match.status === 'live' && <Badge className="bg-live animate-pulse-live border-0"><Radio className="h-3 w-3 mr-1" /> LIVE</Badge>}
              {match.status === 'scheduled' && <Badge variant="secondary">Upcoming</Badge>}
              {match.status === 'completed' && <Badge variant="secondary">Completed</Badge>}
            </div>

            <div className="grid grid-cols-3 items-center gap-4">
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-display tracking-wide">{match.team_a?.short_name || match.team_a?.name || 'TBA'}</p>
                {score && score.batting_team_id === match.team_a_id && (
                  <p className={`text-3xl md:text-4xl font-bold mt-2 ${flash ? 'text-cricket-gold' : ''}`}>
                    {score.runs}/{score.wickets}<span className="text-base font-normal ml-2 opacity-80">({score.overs})</span>
                  </p>
                )}
              </div>
              <div className="text-center text-xl font-display opacity-60">VS</div>
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-display tracking-wide">{match.team_b?.short_name || match.team_b?.name || 'TBA'}</p>
                {score && score.batting_team_id === match.team_b_id && (
                  <p className={`text-3xl md:text-4xl font-bold mt-2 ${flash ? 'text-cricket-gold' : ''}`}>
                    {score.runs}/{score.wickets}<span className="text-base font-normal ml-2 opacity-80">({score.overs})</span>
                  </p>
                )}
              </div>
            </div>

            {match.result_summary && <p className="text-center mt-4 font-medium">{match.result_summary}</p>}
          </div>

          <CardContent className="p-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {format(new Date(match.match_date), 'EEE, MMM d, yyyy • h:mm a')}</div>
            {match.venue && <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {match.venue.name}, {match.venue.city}</div>}
            <div className="ml-auto text-xs">Innings {score?.innings || scoringInnings} • {match.overs_per_innings} overs</div>
          </CardContent>
        </Card>

        {/* Full scorecard */}
        <div className="mb-6">
          <Scorecard
            balls={balls}
            players={players}
            teamAId={match.team_a_id}
            teamBId={match.team_b_id}
            teamAName={match.team_a?.name || 'Team A'}
            teamBName={match.team_b?.name || 'Team B'}
          />
        </div>

        {!canScore && user && (
          <Card className="border-0 shadow-md mb-6 border-l-4 border-l-muted">
            <CardContent className="py-4 text-sm text-muted-foreground">
              Only the tournament organizer (or invited co-scorers) can update this match's score.
            </CardContent>
          </Card>
        )}

        {!user && (
          <Card className="border-0 shadow-md mb-6 border-l-4 border-l-primary">
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Organizer sign-in is required to update this score. Fans can keep watching live without an account.
              </p>
              <Button asChild size="sm" className="bg-gradient-hero hover:opacity-90"><Link to="/auth">Organizer Sign In</Link></Button>
            </CardContent>
          </Card>
        )}

        {canScore && user && scoringBatting && (
          <BallByBallScorer
            matchId={match.id}
            innings={scoringInnings}
            setInnings={setScoringInnings}
            battingTeamId={scoringBatting}
            bowlingTeamId={bowlingTeamId}
            battingTeamName={battingTeamName}
            bowlingTeamName={bowlingTeamName}
            onSwapInnings={() => {
              setScoringBatting(bowlingTeamId);
              setScoringInnings(scoringInnings === 1 ? 2 : 1);
            }}
            players={players}
            balls={balls}
            userId={user.id}
            oversPerInnings={match.overs_per_innings}
            refresh={fetchPlayers}
          />
        )}
      </div>
    </Layout>
  );
}
