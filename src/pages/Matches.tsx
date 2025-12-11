import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Radio, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface Match {
  id: string;
  match_date: string;
  status: string;
  result_summary: string | null;
  overs_per_innings: number;
  tournament: { id: string; name: string } | null;
  team_a: { id: string; name: string; short_name: string | null } | null;
  team_b: { id: string; name: string; short_name: string | null } | null;
  venue: { id: string; name: string; city: string } | null;
  live_scores: {
    batting_team_id: string;
    runs: number;
    wickets: number;
    overs: number;
    target: number | null;
    innings: number;
  }[] | null;
}

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMatches();

    // Subscribe to live score updates
    const channel = supabase
      .channel('live-scores')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_scores',
        },
        () => {
          fetchMatches(); // Refetch when scores update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMatches = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id,
        match_date,
        status,
        result_summary,
        overs_per_innings,
        tournament:tournaments(id, name),
        team_a:teams!matches_team_a_id_fkey(id, name, short_name),
        team_b:teams!matches_team_b_id_fkey(id, name, short_name),
        venue:venues(id, name, city),
        live_scores(batting_team_id, runs, wickets, overs, target, innings)
      `)
      .order('match_date', { ascending: false });

    if (!error && data) {
      // Transform the data to match our interface
      const transformed = data.map((match: any) => ({
        ...match,
        live_scores: match.live_scores ? [match.live_scores].flat() : null,
      }));
      setMatches(transformed as Match[]);
    }
    setIsLoading(false);
  };

  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcomingMatches = matches.filter((m) => m.status === 'scheduled');
  const completedMatches = matches.filter((m) => m.status === 'completed');

  const MatchCard = ({ match }: { match: Match }) => {
    const liveScore = match.live_scores?.[0];

    return (
      <Link to={`/matches/${match.id}`}>
        <Card className="border-0 shadow-md card-hover">
          <CardContent className="p-5">
            {/* Tournament & Status */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                {match.tournament?.name || 'Friendly Match'}
              </span>
              {match.status === 'live' && (
                <Badge className="bg-live animate-pulse-live">
                  <Radio className="h-3 w-3 mr-1" />
                  LIVE
                </Badge>
              )}
              {match.status === 'scheduled' && (
                <Badge variant="secondary">Upcoming</Badge>
              )}
              {match.status === 'completed' && (
                <Badge variant="outline">Completed</Badge>
              )}
            </div>

            {/* Teams */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {match.team_a?.short_name || match.team_a?.name || 'TBA'}
                </span>
                {liveScore && liveScore.batting_team_id === match.team_a?.id && (
                  <span className="font-bold text-lg">
                    {liveScore.runs}/{liveScore.wickets}
                    <span className="text-sm text-muted-foreground ml-1">
                      ({liveScore.overs})
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {match.team_b?.short_name || match.team_b?.name || 'TBA'}
                </span>
                {liveScore && liveScore.batting_team_id === match.team_b?.id && (
                  <span className="font-bold text-lg">
                    {liveScore.runs}/{liveScore.wickets}
                    <span className="text-sm text-muted-foreground ml-1">
                      ({liveScore.overs})
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Result or Info */}
            {match.result_summary && (
              <p className="text-sm text-primary font-medium mt-4">
                {match.result_summary}
              </p>
            )}

            {liveScore?.target && (
              <p className="text-sm text-muted-foreground mt-4">
                Target: {liveScore.target}
              </p>
            )}

            {/* Match Info */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(match.match_date), 'MMM d, h:mm a')}</span>
              </div>
              {match.venue && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{match.venue.city}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  const MatchList = ({ matchList }: { matchList: Match[] }) => {
    if (isLoading) {
      return (
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-md">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-1/3 mb-4" />
                <Skeleton className="h-6 w-2/3 mb-2" />
                <Skeleton className="h-6 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (matchList.length === 0) {
      return (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No matches found</h3>
            <p className="text-muted-foreground">Check back later</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid md:grid-cols-2 gap-6">
        {matchList.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-display mb-2">MATCHES</h1>
          <p className="text-muted-foreground text-lg">
            Live scores and match updates
          </p>
        </div>

        {/* Live Matches Highlight */}
        {liveMatches.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-5 w-5 text-live animate-pulse-live" />
              <h2 className="text-2xl font-display">LIVE NOW</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {liveMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingMatches.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedMatches.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <MatchList matchList={upcomingMatches} />
          </TabsContent>

          <TabsContent value="completed">
            <MatchList matchList={completedMatches} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
