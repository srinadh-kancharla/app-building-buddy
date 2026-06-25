import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trophy, ArrowLeft } from 'lucide-react';

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  description: z.string().trim().max(1000).optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  format: z.enum(['T20', 'ODI', 'Test', 'T10', 'Custom']),
});

export default function CreateTournament() {
  const navigate = useNavigate();
  const { user, isOrganizer, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    format: 'T20' as 'T20' | 'ODI' | 'Test' | 'T10' | 'Custom',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

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

    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        name: result.data.name,
        description: result.data.description || null,
        start_date: result.data.start_date,
        end_date: result.data.end_date || null,
        format: result.data.format,
        organizer_id: user!.id,
        status: 'upcoming',
      })
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      toast({ title: 'Failed to create tournament', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Tournament created!', description: `${form.name} is ready.` });
    navigate(`/dashboard`);
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
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-3xl font-display mb-2">ORGANIZER ACCESS REQUIRED</h1>
          <p className="text-muted-foreground mb-6">Only organizers can create tournaments.</p>
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
            <CardTitle className="text-3xl font-display">CREATE TOURNAMENT</CardTitle>
            <CardDescription>Set up a new cricket tournament</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Tournament Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Summer Cricket League 2026"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tell players and fans about this tournament..."
                  rows={4}
                />
                {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className={errors.start_date ? 'border-destructive' : ''}
                  />
                  {errors.start_date && <p className="text-sm text-destructive">{errors.start_date}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Format *</Label>
                <Select value={form.format} onValueChange={(v: any) => setForm({ ...form, format: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T20">T20 (20 overs)</SelectItem>
                    <SelectItem value="ODI">ODI (50 overs)</SelectItem>
                    <SelectItem value="Test">Test</SelectItem>
                    <SelectItem value="T10">T10 (10 overs)</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/dashboard')} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-gradient-hero hover:opacity-90">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                    </>
                  ) : (
                    'Create Tournament'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
