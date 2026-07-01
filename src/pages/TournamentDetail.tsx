import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Trophy, Calendar, MapPin, ArrowLeft, Plus, Play, Radio, CheckCircle2, Loader2, Pencil, ClipboardEdit,
  Trash2, AlertTriangle,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface Tournament {
  id: string; name: string; format: string; status: string;
  start_date: string; end_date: string | null; description: string | null;
  organizer_id: string;
}
interface MatchRow {
  id: string; match_date: string; status: string; overs_per_innings: number;
  result_summary: string | null;
  team_a: { id: string; name: string; short_name: string | null } | null;
  team_b: { id: string; name: string; short_name: string | null } | null;
  venue: { id: string; name: string; city: string } | null;
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('matches')
        .select(`
          id, match_date, status, overs_per_innings, result_summary,
          team_a:teams!matches_team_a_id_fkey(id, name, short_name),
          team_b:teams!matches_team_b_id_fkey(id, name, short_name),
          venue:venues(id, name, city)
        `)
        .eq('tournament_id', id)
        .order('match_date', { ascending: true }),
    ]);
    if (t) setTournament(t as Tournament);
    if (m) setMatches(m as any);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      if (!user || !id) return setCanManage(false);
      const { data } = await supabase.rpc('can_manage_tournament', { _tournament_id: id });
      setCanManage(!!data);
    })();
  }, [user, id]);

  const setStatus = async (matchId: string, status: 'live' | 'completed') => {
    setUpdatingId(matchId);
    const { error } = await supabase.from('matches').update({ status }).eq('id', matchId);
    setUpdatingId(null);
    if (error) {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: status === 'live' ? 'Match started' : 'Match completed' });
    load();
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-8 max-w-5xl">
          <Skeleton className="h-8 w-40 mb-4" />
          <Skeleton className="h-40 w-full mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!tournament) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-3xl font-display mb-2">TOURNAMENT NOT FOUND</h1>
          <Button onClick={() => navigate('/tournaments')} className="mt-4">Back to Tournaments</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6 max-w-5xl">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/tournaments')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> All Tournaments
        </Button>

        <Card className="border-0 shadow-md mb-6 overflow-hidden">
          <div className="bg-gradient-hero text-primary-foreground p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-wider opacity-80 mb-1">{tournament.format}</p>
                <h1 className="text-3xl md:text-4xl font-display">{tournament.name}</h1>
                <p className="text-sm opacity-80 mt-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(tournament.start_date), 'MMM d, yyyy')}
                  {tournament.end_date && ` – ${format(new Date(tournament.end_date), 'MMM d, yyyy')}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="uppercase">{tournament.status}</Badge>
                {canManage && (
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/tournaments/${tournament.id}/edit`)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
              </div>
            </div>
            {tournament.description && (
              <p className="mt-4 text-sm opacity-90 max-w-2xl">{tournament.description}</p>
            )}
          </div>
        </Card>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-display">MATCHES</h2>
          {canManage && (
            <Button
              className="bg-gradient-hero hover:opacity-90"
              onClick={() => navigate('/matches/create')}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Match
            </Button>
          )}
        </div>

        {matches.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No matches scheduled</h3>
              {canManage && (
                <Button className="mt-2" onClick={() => navigate('/matches/create')}>
                  <Plus className="h-4 w-4 mr-2" /> Schedule first match
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {matches.map((m) => (
              <Card key={m.id} className="border-0 shadow-md card-hover">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2">
                        {m.status === 'live' && (
                          <Badge className="bg-live animate-pulse-live">
                            <Radio className="h-3 w-3 mr-1" /> LIVE
                          </Badge>
                        )}
                        {m.status === 'scheduled' && <Badge variant="secondary">Upcoming</Badge>}
                        {m.status === 'completed' && <Badge variant="outline">Completed</Badge>}
                        <span className="text-xs text-muted-foreground">{m.overs_per_innings} overs</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {m.team_a?.name || 'TBA'} <span className="text-muted-foreground mx-2">vs</span> {m.team_b?.name || 'TBA'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(m.match_date), 'MMM d, h:mm a')}
                        </span>
                        {m.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" /> {m.venue.city}
                          </span>
                        )}
                      </div>
                      {m.result_summary && (
                        <p className="text-sm text-primary font-medium mt-2">{m.result_summary}</p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      {canManage && m.status === 'scheduled' && (
                        <Button
                          size="sm"
                          className="bg-live hover:bg-live/90 text-white"
                          disabled={updatingId === m.id}
                          onClick={() => setStatus(m.id, 'live')}
                        >
                          {updatingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                          Start Match
                        </Button>
                      )}
                      {canManage && m.status === 'live' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === m.id}
                          onClick={() => setStatus(m.id, 'completed')}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> End
                        </Button>
                      )}
                      <Button
                        size="sm"
                        asChild
                        className={canManage ? 'bg-gradient-hero hover:opacity-90' : ''}
                        variant={canManage ? 'default' : 'secondary'}
                      >
                        <Link to={`/matches/${m.id}`}>
                          {canManage ? (<><ClipboardEdit className="h-4 w-4 mr-1" /> Update Score</>) : 'View'}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
