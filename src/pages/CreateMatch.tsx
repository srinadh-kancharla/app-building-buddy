import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar, ArrowLeft, Plus } from 'lucide-react';

const schema = z.object({
  tournament_id: z.string().uuid('Select a tournament'),
  team_a_id: z.string().uuid('Select team A'),
  team_b_id: z.string().uuid('Select team B'),
  venue_id: z.string().optional(),
  match_date: z.string().min(1, 'Match date & time is required'),
  overs_per_innings: z.number().int().min(1).max(90),
}).refine((d) => d.team_a_id !== d.team_b_id, {
  message: 'Team A and Team B must be different',
  path: ['team_b_id'],
});

interface Tournament { id: string; name: string; format: string; }
interface Team { id: string; name: string; tournament_id: string; }
interface Venue { id: string; name: string; city: string; }

export default function CreateMatch() {
  const navigate = useNavigate();
  const { user, isOrganizer, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    tournament_id: '',
    team_a_id: '',
    team_b_id: '',
    venue_id: '',
    match_date: '',
    overs_per_innings: 20,
  });

  // Quick-add team dialog state
  const [newTeamName, setNewTeamName] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) loadInitial();
  }, [user]);

  const loadInitial = async () => {
    const [{ data: t }, { data: v }] = await Promise.all([
      supabase.from('tournaments').select('id, name, format').eq('organizer_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('venues').select('id, name, city').order('name'),
    ]);
    if (t) setTournaments(t);
    if (v) setVenues(v);
  };

  useEffect(() => {
    if (!form.tournament_id) {
      setTeams([]);
      return;
    }
    supabase
      .from('teams')
      .select('id, name, tournament_id')
      .eq('tournament_id', form.tournament_id)
      .order('name')
      .then(({ data }) => setTeams(data || []));

    // Auto-set overs based on format
    const t = tournaments.find((x) => x.id === form.tournament_id);
    if (t) {
      const defaults: Record<string, number> = { T20: 20, ODI: 50, T10: 10, Test: 90 };
      setForm((f) => ({ ...f, overs_per_innings: defaults[t.format] ?? 20, team_a_id: '', team_b_id: '' }));
    }
  }, [form.tournament_id]);

  const handleAddTeam = async () => {
    if (!form.tournament_id || newTeamName.trim().length < 2) {
      toast({ title: 'Select a tournament and enter a team name', variant: 'destructive' });
      return;
    }
    setAddingTeam(true);
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: newTeamName.trim(), tournament_id: form.tournament_id })
      .select('id, name, tournament_id')
      .single();
    setAddingTeam(false);
    if (error) {
      toast({ title: 'Failed to add team', description: error.message, variant: 'destructive' });
      return;
    }
    setTeams([...teams, data]);
    setNewTeamName('');
    toast({ title: 'Team added', description: data.name });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((er) => {
        if (er.path[0]) errs[er.path[0] as string] = er.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const { error } = await supabase.from('matches').insert({
      tournament_id: result.data.tournament_id,
      team_a_id: result.data.team_a_id,
      team_b_id: result.data.team_b_id,
      venue_id: result.data.venue_id || null,
      match_date: new Date(result.data.match_date).toISOString(),
      overs_per_innings: result.data.overs_per_innings,
      status: 'scheduled',
    });

    setSubmitting(false);

    if (error) {
      toast({ title: 'Failed to create match', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Match created!', description: 'Your match has been scheduled.' });
    navigate('/matches');
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isOrganizer) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-3xl font-display mb-2">ORGANIZER ACCESS REQUIRED</h1>
          <p className="text-muted-foreground mb-6">Only organizers can create matches.</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 max-w-2xl">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-3xl font-display">CREATE MATCH</CardTitle>
            <CardDescription>Schedule a new match in one of your tournaments</CardDescription>
          </CardHeader>
          <CardContent>
            {tournaments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You need to create a tournament first.</p>
                <Button onClick={() => navigate('/tournaments/create')} className="bg-gradient-hero">
                  <Plus className="h-4 w-4 mr-2" /> Create Tournament
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label>Tournament *</Label>
                  <Select
                    value={form.tournament_id}
                    onValueChange={(v) => setForm({ ...form, tournament_id: v })}
                  >
                    <SelectTrigger className={errors.tournament_id ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select tournament" />
                    </SelectTrigger>
                    <SelectContent>
                      {tournaments.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.format})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tournament_id && <p className="text-sm text-destructive">{errors.tournament_id}</p>}
                </div>

                {form.tournament_id && (
                  <div className="space-y-2 rounded-lg border border-dashed p-3 bg-muted/30">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Add team to this tournament
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Team name"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                      />
                      <Button type="button" variant="outline" onClick={handleAddTeam} disabled={addingTeam}>
                        {addingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Team A *</Label>
                    <Select
                      value={form.team_a_id}
                      onValueChange={(v) => setForm({ ...form, team_a_id: v })}
                      disabled={!form.tournament_id}
                    >
                      <SelectTrigger className={errors.team_a_id ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select team A" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.team_a_id && <p className="text-sm text-destructive">{errors.team_a_id}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Team B *</Label>
                    <Select
                      value={form.team_b_id}
                      onValueChange={(v) => setForm({ ...form, team_b_id: v })}
                      disabled={!form.tournament_id}
                    >
                      <SelectTrigger className={errors.team_b_id ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select team B" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.filter((t) => t.id !== form.team_a_id).map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.team_b_id && <p className="text-sm text-destructive">{errors.team_b_id}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="match_date">Match Date & Time *</Label>
                  <Input
                    id="match_date"
                    type="datetime-local"
                    value={form.match_date}
                    onChange={(e) => setForm({ ...form, match_date: e.target.value })}
                    className={errors.match_date ? 'border-destructive' : ''}
                  />
                  {errors.match_date && <p className="text-sm text-destructive">{errors.match_date}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Venue (optional)</Label>
                    <Select
                      value={form.venue_id}
                      onValueChange={(v) => setForm({ ...form, venue_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={venues.length ? 'Select venue' : 'No venues yet'} />
                      </SelectTrigger>
                      <SelectContent>
                        {venues.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name} — {v.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overs">Overs per innings *</Label>
                    <Input
                      id="overs"
                      type="number"
                      min={1}
                      max={90}
                      value={form.overs_per_innings}
                      onChange={(e) => setForm({ ...form, overs_per_innings: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => navigate('/dashboard')} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="flex-1 bg-gradient-hero hover:opacity-90">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scheduling...
                      </>
                    ) : (
                      'Schedule Match'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
