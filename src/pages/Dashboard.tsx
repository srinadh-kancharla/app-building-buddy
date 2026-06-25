import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { 
  Trophy, 
  Plus, 
  Calendar, 
  Users, 
  MapPin,
  ArrowRight,
  BarChart3 
} from 'lucide-react';
import { format } from 'date-fns';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  status: string;
  format: string;
}

export default function Dashboard() {
  const { user, isOrganizer, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ tournaments: 0, matches: 0, teams: 0 });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    // Fetch user's tournaments
    const { data: tournamentsData } = await supabase
      .from('tournaments')
      .select('id, name, start_date, status, format')
      .eq('organizer_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (tournamentsData) {
      setTournaments(tournamentsData);
    }

    // Fetch stats
    const { count: tournamentCount } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .eq('organizer_id', user?.id);

    const { data: userTournaments } = await supabase
      .from('tournaments')
      .select('id')
      .eq('organizer_id', user?.id);

    const tournamentIds = userTournaments?.map((t) => t.id) || [];

    let matchCount = 0;
    let teamCount = 0;

    if (tournamentIds.length > 0) {
      const { count: mCount } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .in('tournament_id', tournamentIds);
      matchCount = mCount || 0;

      const { count: tCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .in('tournament_id', tournamentIds);
      teamCount = tCount || 0;
    }

    setStats({
      tournaments: tournamentCount || 0,
      matches: matchCount,
      teams: teamCount,
    });

    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container py-8">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isOrganizer) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h1 className="text-3xl font-display mb-4">ORGANIZER ACCESS REQUIRED</h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            You need organizer privileges to access the dashboard. 
            Contact an admin to upgrade your account.
          </p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-display mb-2">DASHBOARD</h1>
            <p className="text-muted-foreground">Manage your tournaments and matches</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => navigate('/matches/create')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Create Match
            </Button>
            <Button 
              className="bg-gradient-hero hover:opacity-90" 
              onClick={() => navigate('/tournaments/create')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Tournament
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats.tournaments}</p>
                  <p className="text-muted-foreground text-sm">Tournaments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats.matches}</p>
                  <p className="text-muted-foreground text-sm">Matches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cricket-gold/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-cricket-gold" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats.teams}</p>
                  <p className="text-muted-foreground text-sm">Teams</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Tournaments */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Your Tournaments</CardTitle>
                <CardDescription>Recent tournaments you've created</CardDescription>
              </div>
              <Button variant="ghost" onClick={() => navigate('/tournaments')}>
                View All <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : tournaments.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No tournaments yet</h3>
                <p className="text-muted-foreground mb-4">Create your first tournament to get started</p>
                <Button onClick={() => navigate('/tournaments/create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tournament
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {tournaments.map((tournament) => (
                  <div
                    key={tournament.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => navigate(`/tournaments/${tournament.id}/manage`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Trophy className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{tournament.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(tournament.start_date), 'MMM d, yyyy')} • {tournament.format}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={tournament.status === 'ongoing' ? 'default' : 'secondary'}>
                        {tournament.status}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
