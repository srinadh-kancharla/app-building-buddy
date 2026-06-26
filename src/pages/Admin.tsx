import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Shield,
  Users,
  Trophy,
  Calendar,
  Megaphone,
  Plus,
  Trash2,
  Pencil,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';

type AppRole = 'admin' | 'organizer' | 'user';

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: AppRole[];
}

interface TournamentRow {
  id: string;
  name: string;
  format: string;
  status: string;
  start_date: string;
  organizer_id: string;
}

interface MatchRow {
  id: string;
  match_date: string;
  status: string;
  tournament_id: string;
  team_a_id: string;
  team_b_id: string;
}

interface Promotion {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

const ROLE_ORDER: AppRole[] = ['admin', 'organizer', 'user'];

const roleVariant = (role: AppRole) =>
  role === 'admin' ? 'default' : role === 'organizer' ? 'secondary' : 'outline';

const isSafeHttpUrl = (url: string | null | undefined): url is string => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Promotion dialog state
  const [promoOpen, setPromoOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [promoForm, setPromoForm] = useState({
    title: '',
    body: '',
    image_url: '',
    link_url: '',
    is_active: true,
    display_order: 0,
  });

  const loadAll = async () => {
    setLoading(true);
    const [{ data: profs }, { data: rolesData }, { data: tours }, { data: mts }, { data: promos }] =
      await Promise.all([
        supabase.from('profiles').select('id, email, full_name, created_at').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('tournaments').select('id, name, format, status, start_date, organizer_id').order('start_date', { ascending: false }),
        supabase.from('matches').select('id, match_date, status, tournament_id, team_a_id, team_b_id').order('match_date', { ascending: false }),
        supabase.from('promotions').select('*').order('display_order', { ascending: true }),
      ]);

    const rolesByUser = new Map<string, AppRole[]>();
    (rolesData ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    });

    setProfiles(
      (profs ?? []).map((p: any) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      }))
    );
    setTournaments((tours ?? []) as TournamentRow[]);
    setMatches((mts ?? []) as MatchRow[]);
    setPromotions((promos ?? []) as Promotion[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    if (userId === user?.id && role === 'admin' && has) {
      toast.error("You can't revoke your own admin role");
      return;
    }

    if (has) {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      if (error) return toast.error(error.message);
      toast.success(`Removed ${role}`);
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
      toast.success(`Granted ${role}`);
    }
    loadAll();
  };

  const openNewPromo = () => {
    setEditingPromo(null);
    setPromoForm({
      title: '',
      body: '',
      image_url: '',
      link_url: '',
      is_active: true,
      display_order: promotions.length,
    });
    setPromoOpen(true);
  };

  const openEditPromo = (p: Promotion) => {
    setEditingPromo(p);
    setPromoForm({
      title: p.title,
      body: p.body ?? '',
      image_url: p.image_url ?? '',
      link_url: p.link_url ?? '',
      is_active: p.is_active,
      display_order: p.display_order,
    });
    setPromoOpen(true);
  };

  const savePromo = async () => {
    if (!promoForm.title.trim()) return toast.error('Title is required');

    const linkUrl = promoForm.link_url.trim();
    if (linkUrl && !isSafeHttpUrl(linkUrl)) {
      return toast.error('Link URL must start with http:// or https://');
    }
    const imageUrl = promoForm.image_url.trim();
    if (imageUrl && !isSafeHttpUrl(imageUrl)) {
      return toast.error('Image URL must start with http:// or https://');
    }

    const payload = {
      title: promoForm.title.trim(),
      body: promoForm.body.trim() || null,
      image_url: imageUrl || null,
      link_url: linkUrl || null,
      is_active: promoForm.is_active,
      display_order: Number(promoForm.display_order) || 0,
    };

    if (editingPromo) {
      const { error } = await supabase.from('promotions').update(payload).eq('id', editingPromo.id);
      if (error) return toast.error(error.message);
      toast.success('Promotion updated');
    } else {
      const { error } = await supabase
        .from('promotions')
        .insert({ ...payload, created_by: user?.id });
      if (error) return toast.error(error.message);
      toast.success('Promotion created');
    }
    setPromoOpen(false);
    loadAll();
  };

  const deletePromo = async (id: string) => {
    if (!confirm('Delete this promotion?')) return;
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Promotion deleted');
    loadAll();
  };

  const togglePromoActive = async (p: Promotion) => {
    const { error } = await supabase
      .from('promotions')
      .update({ is_active: !p.is_active })
      .eq('id', p.id);
    if (error) return toast.error(error.message);
    loadAll();
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      !search ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const tournamentName = (id: string) => tournaments.find((t) => t.id === id)?.name ?? '—';

  if (loading) {
    return (
      <Layout>
        <div className="container py-20 text-center text-muted-foreground">Loading…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-hero">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-4xl font-display tracking-wide">ADMIN PANEL</h1>
            <p className="text-muted-foreground">Manage users, tournaments and promotions.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users className="h-5 w-5" />} label="Users" value={profiles.length} />
          <StatCard
            icon={<Shield className="h-5 w-5" />}
            label="Organizers"
            value={profiles.filter((p) => p.roles.includes('organizer')).length}
          />
          <StatCard icon={<Trophy className="h-5 w-5" />} label="Tournaments" value={tournaments.length} />
          <StatCard icon={<Calendar className="h-5 w-5" />} label="Matches" value={matches.length} />
        </div>

        <Tabs defaultValue="users">
          <TabsList className="grid grid-cols-4 w-full md:w-auto">
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />Users</TabsTrigger>
            <TabsTrigger value="tournaments"><Trophy className="h-4 w-4 mr-2" />Tournaments</TabsTrigger>
            <TabsTrigger value="matches"><Calendar className="h-4 w-4 mr-2" />Matches</TabsTrigger>
            <TabsTrigger value="promotions"><Megaphone className="h-4 w-4 mr-2" />Promotions</TabsTrigger>
          </TabsList>

          {/* USERS */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Grant or revoke organizer and admin roles.</CardDescription>
                <Input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-sm mt-2"
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProfiles.map((p) => {
                        const isOrg = p.roles.includes('organizer');
                        const isAdm = p.roles.includes('admin');
                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="font-medium">{p.full_name || '—'}</div>
                              <div className="text-xs text-muted-foreground">{p.email}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {ROLE_ORDER.filter((r) => p.roles.includes(r)).map((r) => (
                                  <Badge key={r} variant={roleVariant(r)}>{r}</Badge>
                                ))}
                                {p.roles.length === 0 && (
                                  <span className="text-xs text-muted-foreground">none</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                variant={isOrg ? 'outline' : 'secondary'}
                                onClick={() => toggleRole(p.id, 'organizer', isOrg)}
                              >
                                {isOrg ? (
                                  <><ArrowDownCircle className="h-4 w-4 mr-1" />Demote</>
                                ) : (
                                  <><ArrowUpCircle className="h-4 w-4 mr-1" />Promote</>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={isAdm ? 'destructive' : 'default'}
                                onClick={() => toggleRole(p.id, 'admin', isAdm)}
                              >
                                <Shield className="h-4 w-4 mr-1" />
                                {isAdm ? 'Revoke admin' : 'Make admin'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredProfiles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            {loading ? 'Loading…' : 'No users found.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TOURNAMENTS */}
          <TabsContent value="tournaments">
            <Card>
              <CardHeader>
                <CardTitle>All Tournaments</CardTitle>
                <CardDescription>Every tournament on the platform.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Start date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tournaments.map((t) => (
                        <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/tournaments`)}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell><Badge variant="outline">{t.format}</Badge></TableCell>
                          <TableCell><Badge>{t.status}</Badge></TableCell>
                          <TableCell>{new Date(t.start_date).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                      {tournaments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No tournaments yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MATCHES */}
          <TabsContent value="matches">
            <Card>
              <CardHeader>
                <CardTitle>All Matches</CardTitle>
                <CardDescription>Every scheduled and completed match.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Tournament</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matches.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{new Date(m.match_date).toLocaleString()}</TableCell>
                          <TableCell>{tournamentName(m.tournament_id)}</TableCell>
                          <TableCell><Badge>{m.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/matches/${m.id}`)}>
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {matches.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No matches yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROMOTIONS */}
          <TabsContent value="promotions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Promotions Space</CardTitle>
                  <CardDescription>Banners and announcements shown across the app.</CardDescription>
                </div>
                <Button onClick={openNewPromo}>
                  <Plus className="h-4 w-4 mr-2" /> New promotion
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {promotions.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">No promotions yet.</div>
                )}
                {promotions.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-lg border bg-card"
                  >
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt={p.title}
                        className="w-full md:w-32 h-20 object-cover rounded-md"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{p.title}</h3>
                        <Badge variant={p.is_active ? 'default' : 'outline'}>
                          {p.is_active ? 'Active' : 'Hidden'}
                        </Badge>
                        <Badge variant="outline">#{p.display_order}</Badge>
                      </div>
                      {p.body && <p className="text-sm text-muted-foreground line-clamp-2">{p.body}</p>}
                      {isSafeHttpUrl(p.link_url) && (
                        <a
                          href={p.link_url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline truncate block"
                        >
                          {p.link_url}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.is_active} onCheckedChange={() => togglePromoActive(p)} />
                      <Button size="icon" variant="outline" onClick={() => openEditPromo(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="destructive" onClick={() => deletePromo(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Promotion dialog */}
      <Dialog open={promoOpen} onOpenChange={setPromoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPromo ? 'Edit promotion' : 'New promotion'}</DialogTitle>
            <DialogDescription>Banners shown to users on the home page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={promoForm.title}
                onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                value={promoForm.body}
                onChange={(e) => setPromoForm({ ...promoForm, body: e.target.value })}
              />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input
                value={promoForm.image_url}
                onChange={(e) => setPromoForm({ ...promoForm, image_url: e.target.value })}
              />
            </div>
            <div>
              <Label>Link URL</Label>
              <Input
                value={promoForm.link_url}
                onChange={(e) => setPromoForm({ ...promoForm, link_url: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Display order</Label>
                <Input
                  type="number"
                  value={promoForm.display_order}
                  onChange={(e) =>
                    setPromoForm({ ...promoForm, display_order: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  checked={promoForm.is_active}
                  onCheckedChange={(v) => setPromoForm({ ...promoForm, is_active: v })}
                />
                <Label className="mb-2">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoOpen(false)}>Cancel</Button>
            <Button onClick={savePromo}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <div className="text-2xl font-display">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
