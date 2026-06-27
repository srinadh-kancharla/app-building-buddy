import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
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
import { Loader2, Trophy, ArrowLeft, Trash2, Save } from 'lucide-react';

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  format: z.enum(['T20', 'ODI', 'Test', 'T10', 'Custom']),
  status: z.enum(['upcoming', 'ongoing', 'completed', 'cancelled']),
});

export default function EditTournament() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: '', description: '', start_date: '', end_date: '',
    format: 'T20' as 'T20' | 'ODI' | 'Test' | 'T10' | 'Custom',
    status: 'upcoming' as 'upcoming' | 'ongoing' | 'completed' | 'cancelled',
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const [{ data: t }, { data: perm }] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
        supabase.rpc('can_manage_tournament', { _tournament_id: id }),
      ]);
      if (t) {
        setForm({
          name: t.name || '',
          description: t.description || '',
          start_date: t.start_date || '',
          end_date: t.end_date || '',
          format: (t.format as any) || 'T20',
          status: (t.status as any) || 'upcoming',
        });
      }
      setCanManage(!!perm);
      setLoading(false);
    })();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((er) => { if (er.path[0]) errs[er.path[0] as string] = er.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await supabase.from('tournaments').update({
      name: result.data.name,
      description: result.data.description || null,
      start_date: result.data.start_date,
      end_date: result.data.end_date || null,
      format: result.data.format,
      status: result.data.status,
    }).eq('id', id!);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Tournament updated' });
    navigate(`/tournaments/${id}`);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('tournaments').delete().eq('id', id!);
    setDeleting(false);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Tournament deleted' });
    navigate('/tournaments');
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!canManage) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-3xl font-display mb-2">NOT AUTHORIZED</h1>
          <p className="text-muted-foreground mb-6">Only the tournament organizer or an admin can edit this.</p>
          <Button onClick={() => navigate(`/tournaments/${id}`)}>Back to Tournament</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 max-w-2xl">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(`/tournaments/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Tournament
        </Button>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-3xl font-display">EDIT TOURNAMENT</CardTitle>
            <CardDescription>Update tournament details, schedule or status</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Tournament Name *</Label>
                <Input id="name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={errors.name ? 'border-destructive' : ''} />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={4} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input id="start_date" type="date" value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  {errors.start_date && <p className="text-sm text-destructive">{errors.start_date}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input id="end_date" type="date" value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Format *</Label>
                  <Select value={form.format} onValueChange={(v: any) => setForm({ ...form, format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="T20">T20 (20 overs)</SelectItem>
                      <SelectItem value="ODI">ODI (50 overs)</SelectItem>
                      <SelectItem value="Test">Test</SelectItem>
                      <SelectItem value="T10">T10 (10 overs)</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status *</Label>
                  <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="ongoing">Ongoing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this tournament?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the tournament and all its matches & scores. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button type="button" variant="outline" onClick={() => navigate(`/tournaments/${id}`)} className="ml-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-gradient-hero hover:opacity-90">
                  {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>) : (<><Save className="h-4 w-4 mr-2" /> Save Changes</>)}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
