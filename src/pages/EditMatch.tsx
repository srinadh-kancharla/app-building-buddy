import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Trash2, Save } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned (weather / ground issue)' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'postponed', label: 'Postponed' },
];

interface Team { id: string; name: string; }
interface Venue { id: string; name: string; city: string; }

export default function EditMatch() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [tournamentId, setTournamentId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  const [form, setForm] = useState({
    team_a_id: '',
    team_b_id: '',
    venue_id: '',
    match_date: '',
    overs_per_innings: 20,
    status: 'scheduled',
    result_summary: '',
  });

  const load = useCallback(async () => {
    if (!id) return;
    const { data: m } = await supabase.from('matches').select('*').eq('id', id).maybeSingle();
    if (!m) { setLoading(false); return; }
    setTournamentId(m.tournament_id);
    setForm({
      team_a_id: m.team_a_id,
      team_b_id: m.team_b_id,
      venue_id: m.venue_id || '',
      match_date: new Date(m.match_date).toISOString().slice(0, 16),
      overs_per_innings: m.overs_per_innings,
      status: m.status,
      result_summary: m.result_summary || '',
    });
    const [{ data: t }, { data: v }, { data: perm }] = await Promise.all([
      supabase.from('teams').select('id, name').eq('tournament_id', m.tournament_id).order('name'),
      supabase.from('venues').select('id, name, city').order('name'),
      supabase.rpc('can_manage_tournament', { _tournament_id: m.tournament_id }),
    ]);
    setTeams(t || []);
    setVenues(v || []);
    setCanManage(!!perm);
    setLoading(false);
  }, [id]);

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) load(); }, [user, load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.team_a_id === form.team_b_id) {
      toast({ title: 'Team A and Team B must be different', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('matches').update({
      team_a_id: form.team_a_id,
      team_b_id: form.team_b_id,
      venue_id: form.venue_id || null,
      match_date: new Date(form.match_date).toISOString(),
      overs_per_innings: form.overs_per_innings,
      status: form.status,
      result_summary: form.result_summary.trim() || null,
    }).eq('id', id!);
    setSaving(false);
    if (error) { toast({ title: 'Failed to save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Match updated' });
    navigate(`/tournaments/${tournamentId}`);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('matches').delete().eq('id', id!);
    setDeleting(false);
    if (error) { toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Match deleted' });
    navigate(`/tournaments/${tournamentId}`);
  };

  if (authLoading || loading) {
    return <Layout><div className="container py-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  }

  if (!canManage) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-3xl font-display mb-2">ACCESS DENIED</h1>
          <p className="text-muted-foreground mb-6">Only the tournament organizer can edit this match.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </Layout>
    );
  }

  const isIssueStatus = ['abandoned', 'cancelled', 'postponed'].includes(form.status);

  return (
    <Layout>
      <div className="container py-8 max-w-2xl">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(`/tournaments/${tournamentId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Tournament
        </Button>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-3xl font-display">EDIT MATCH</CardTitle>
            <CardDescription>Update match details, change status, or delete this match</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Team A *</Label>
                  <Select value={form.team_a_id} onValueChange={(v) => setForm({ ...form, team_a_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Team B *</Label>
                  <Select value={form.team_b_id} onValueChange={(v) => setForm({ ...form, team_b_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Match date & time *</Label>
                  <Input type="datetime-local" value={form.match_date}
                    onChange={(e) => setForm({ ...form, match_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Overs per innings *</Label>
                  <Input type="number" min={1} max={90} value={form.overs_per_innings}
                    onChange={(e) => setForm({ ...form, overs_per_innings: parseInt(e.target.value || '0') })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Venue</Label>
                <Select value={form.venue_id || 'none'} onValueChange={(v) => setForm({ ...form, venue_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}, {v.city}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
                <Label className="text-sm font-semibold">Match Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Label className="text-sm mt-3 block">
                  {isIssueStatus ? 'Reason / issue note *' : 'Result summary (optional)'}
                </Label>
                <Textarea
                  rows={2}
                  placeholder={isIssueStatus
                    ? 'e.g. Match abandoned due to heavy rain, no result possible'
                    : 'e.g. Team A won by 25 runs'}
                  value={form.result_summary}
                  onChange={(e) => setForm({ ...form, result_summary: e.target.value })}
                />
                {isIssueStatus && (
                  <p className="text-xs text-muted-foreground">
                    This message will be shown to viewers explaining why the match ended.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button type="submit" disabled={saving} className="bg-gradient-hero hover:opacity-90 flex-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={deleting}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Match
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this match?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the match and all ball-by-ball scoring data. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
