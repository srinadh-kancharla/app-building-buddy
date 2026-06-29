import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Radio, Plus, Undo2, ArrowLeftRight, UserPlus } from 'lucide-react';
import { BallRow, PlayerLite, nextBallPosition } from '@/lib/scorecard';

interface Props {
  matchId: string;
  innings: number;
  setInnings: (n: number) => void;
  battingTeamId: string;
  bowlingTeamId: string;
  battingTeamName: string;
  bowlingTeamName: string;
  onSwapInnings: () => void;
  players: PlayerLite[];
  balls: BallRow[];
  userId: string;
  oversPerInnings: number;
  refresh: () => void;
}

type Outcome =
  | { kind: 'runs'; runs: number }
  | { kind: 'wide'; runs: number }
  | { kind: 'noball'; runs: number }
  | { kind: 'bye'; runs: number }
  | { kind: 'legbye'; runs: number }
  | { kind: 'wicket'; wicket_type: string; out_player_id: string; fielder_id?: string; runs: number };

export default function BallByBallScorer(props: Props) {
  const { toast } = useToast();
  const {
    matchId, innings, setInnings, battingTeamId, bowlingTeamId,
    battingTeamName, bowlingTeamName, onSwapInnings,
    players, balls, userId, refresh,
  } = props;

  const battingTeamPlayers = useMemo(() => players.filter(p => p.team_id === battingTeamId), [players, battingTeamId]);
  const bowlingTeamPlayers = useMemo(() => players.filter(p => p.team_id === bowlingTeamId), [players, bowlingTeamId]);

  const [strikerId, setStrikerId] = useState<string>('');
  const [nonStrikerId, setNonStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');

  // Seed selectors from last ball
  useEffect(() => {
    const inningsBalls = balls.filter(b => b.innings === innings);
    const last = inningsBalls[inningsBalls.length - 1];
    if (last) {
      if (!strikerId && last.striker_id) setStrikerId(last.striker_id);
      if (!nonStrikerId && last.non_striker_id) setNonStrikerId(last.non_striker_id);
      if (!bowlerId && last.bowler_id) setBowlerId(last.bowler_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balls, innings]);

  const [addPlayerOpen, setAddPlayerOpen] = useState<null | { team_id: string; assignTo: 'striker'|'nonstriker'|'bowler'|'fielder'|'out' }>(null);
  const [newPlayerName, setNewPlayerName] = useState('');

  const [wicketOpen, setWicketOpen] = useState(false);
  const [extraRunsOpen, setExtraRunsOpen] = useState<null | { type: 'wd'|'nb'|'b'|'lb' }>(null);
  const [extraRunsValue, setExtraRunsValue] = useState('0');
  const [wicketType, setWicketType] = useState('bowled');
  const [outPlayerId, setOutPlayerId] = useState<string>('');
  const [fielderId, setFielderId] = useState<string>('');

  const addPlayer = async () => {
    if (!addPlayerOpen || !newPlayerName.trim()) return;
    const { data, error } = await supabase.from('players').insert({
      team_id: addPlayerOpen.team_id, name: newPlayerName.trim(),
    }).select().single();
    if (error) { toast({ title: 'Failed to add player', description: error.message, variant: 'destructive' }); return; }
    const id = data.id;
    const slot = addPlayerOpen.assignTo;
    setAddPlayerOpen(null);
    setNewPlayerName('');
    refresh();
    if (slot === 'striker') setStrikerId(id);
    else if (slot === 'nonstriker') setNonStrikerId(id);
    else if (slot === 'bowler') setBowlerId(id);
    else if (slot === 'out') setOutPlayerId(id);
    else if (slot === 'fielder') setFielderId(id);
  };

  const insertBall = async (o: Outcome) => {
    if (!strikerId || !nonStrikerId || !bowlerId) {
      toast({ title: 'Set players first', description: 'Pick striker, non-striker, and bowler.', variant: 'destructive' });
      return;
    }

    const inningsBalls = balls.filter(b => b.innings === innings);
    const pos = nextBallPosition(inningsBalls, innings);

    let runs = 0, extra_runs = 0, extra_type: string | null = null;
    let is_legal = true, is_wicket = false;
    let wicket_type: string | null = null;
    let out_player_id: string | null = null;
    let fielder_id: string | null = null;

    if (o.kind === 'runs') { runs = o.runs; }
    else if (o.kind === 'wide') { extra_type = 'wd'; extra_runs = 1 + o.runs; is_legal = false; }
    else if (o.kind === 'noball') { extra_type = 'nb'; runs = o.runs; extra_runs = 1; is_legal = false; }
    else if (o.kind === 'bye') { extra_type = 'b'; runs = o.runs; }
    else if (o.kind === 'legbye') { extra_type = 'lb'; runs = o.runs; }
    else if (o.kind === 'wicket') {
      is_wicket = true; wicket_type = o.wicket_type;
      out_player_id = o.out_player_id; fielder_id = o.fielder_id || null;
      runs = o.runs;
    }

    // For non-legal balls, store same over_number but a sentinel ball_number = next legal slot (won't advance)
    const ball_number = is_legal ? pos.ball_number : pos.ball_number;
    const over_number = pos.over_number;

    const payload = {
      match_id: matchId,
      innings,
      batting_team_id: battingTeamId,
      bowling_team_id: bowlingTeamId,
      over_number, ball_number, is_legal,
      striker_id: strikerId,
      non_striker_id: nonStrikerId,
      bowler_id: bowlerId,
      runs, extra_type, extra_runs,
      is_wicket, wicket_type, out_player_id, fielder_id,
      created_by: userId,
    };

    const { error } = await supabase.from('balls').insert(payload);
    if (error) { toast({ title: 'Failed to record', description: error.message, variant: 'destructive' }); return; }

    // Sync live_scores aggregate
    await syncLiveScores();

    // Strike rotation
    const totalRunsOnBall = runs + extra_runs;
    if (is_legal && (runs % 2 === 1)) {
      const tmp = strikerId; setStrikerId(nonStrikerId); setNonStrikerId(tmp);
    }
    // End of over rotation
    if (is_legal && pos.ball_number === 6) {
      const tmp = strikerId; setStrikerId(nonStrikerId); setNonStrikerId(tmp);
      toast({ title: `Over ${pos.over_number + 1} complete`, description: 'Strike rotated. Select next bowler.' });
    }
    // On wicket of striker
    if (is_wicket && (out_player_id === strikerId || !out_player_id)) {
      setStrikerId('');
    } else if (is_wicket && out_player_id === nonStrikerId) {
      setNonStrikerId('');
    }
  };

  const syncLiveScores = async () => {
    // Re-fetch all balls for this innings (after insert/delete) to compute totals
    const { data } = await supabase
      .from('balls')
      .select('runs, extra_runs, is_legal, is_wicket, extra_type, over_number, ball_number, created_at')
      .eq('match_id', matchId)
      .eq('innings', innings)
      .order('created_at', { ascending: true });
    const rows = data || [];
    let totalRuns = 0, wickets = 0, legal = 0;
    for (const r of rows) {
      totalRuns += (r.runs || 0) + (r.extra_runs || 0);
      if (r.is_wicket) wickets += 1;
      if (r.is_legal) legal += 1;
    }
    const overs = +(Math.floor(legal/6) + (legal%6)/10).toFixed(1);
    const crr = legal > 0 ? +((totalRuns * 6) / legal).toFixed(2) : null;

    await supabase.from('live_scores').upsert({
      match_id: matchId,
      batting_team_id: battingTeamId,
      runs: totalRuns,
      wickets,
      overs,
      innings,
      current_run_rate: crr,
      updated_by: userId,
      last_updated_at: new Date().toISOString(),
    }, { onConflict: 'match_id' });

    await supabase.from('matches').update({ status: 'live' }).eq('id', matchId);
  };

  const undoLast = async () => {
    const inningsBalls = balls.filter(b => b.innings === innings);
    const last = inningsBalls[inningsBalls.length - 1];
    if (!last) return;
    if (!confirm('Delete the last ball?')) return;
    const { error } = await supabase.from('balls').delete().eq('id', last.id);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    await syncLiveScores();
  };

  const swapStrike = () => {
    const t = strikerId; setStrikerId(nonStrikerId); setNonStrikerId(t);
  };

  const submitWicket = () => {
    if (!outPlayerId) { toast({ title: 'Pick the dismissed batter', variant: 'destructive' }); return; }
    insertBall({ kind: 'wicket', wicket_type: wicketType, out_player_id: outPlayerId, fielder_id: fielderId || undefined, runs: 0 });
    setWicketOpen(false); setOutPlayerId(''); setFielderId(''); setWicketType('bowled');
  };

  const submitExtraRuns = () => {
    if (!extraRunsOpen) return;
    const runs = parseInt(extraRunsValue) || 0;
    const t = extraRunsOpen.type;
    if (t === 'wd') insertBall({ kind: 'wide', runs });
    else if (t === 'nb') insertBall({ kind: 'noball', runs });
    else if (t === 'b') insertBall({ kind: 'bye', runs });
    else if (t === 'lb') insertBall({ kind: 'legbye', runs });
    setExtraRunsOpen(null); setExtraRunsValue('0');
  };

  const PlayerSelector = ({ value, onChange, team, label, slot }: {
    value: string; onChange: (v: string)=>void; team: PlayerLite[]; label: string;
    slot: 'striker'|'nonstriker'|'bowler';
  }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {team.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" size="icon" variant="outline"
          onClick={() => setAddPlayerOpen({ team_id: team === battingTeamPlayers ? battingTeamId : bowlingTeamId, assignTo: slot })}>
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="border-0 shadow-md border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" /> Ball-by-Ball Scoring
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">Innings {innings}</Badge>
          <span className="text-muted-foreground">Batting: <strong className="text-foreground">{battingTeamName}</strong></span>
          <Button size="sm" variant="ghost" onClick={onSwapInnings} className="ml-auto h-7">
            <ArrowLeftRight className="h-3 w-3 mr-1" /> Switch to {bowlingTeamName} batting
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PlayerSelector value={strikerId} onChange={setStrikerId} team={battingTeamPlayers} label="Striker *" slot="striker" />
          <PlayerSelector value={nonStrikerId} onChange={setNonStrikerId} team={battingTeamPlayers} label="Non-striker" slot="nonstriker" />
          <PlayerSelector value={bowlerId} onChange={setBowlerId} team={bowlingTeamPlayers} label="Bowler *" slot="bowler" />
        </div>

        <div className="flex flex-wrap gap-2">
          {[0,1,2,3,4,6].map(r => (
            <Button key={r} onClick={() => insertBall({ kind: 'runs', runs: r })}
              className={`h-14 w-14 text-xl font-bold ${r===4?'bg-cricket-gold text-foreground hover:bg-cricket-gold/90':r===6?'bg-primary text-primary-foreground hover:bg-primary/90':'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              {r}
            </Button>
          ))}
          <Button onClick={() => setWicketOpen(true)} className="h-14 px-5 text-lg font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90">
            W
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setExtraRunsValue('0'); setExtraRunsOpen({ type: 'wd' }); }}>Wide</Button>
          <Button variant="outline" onClick={() => { setExtraRunsValue('0'); setExtraRunsOpen({ type: 'nb' }); }}>No Ball</Button>
          <Button variant="outline" onClick={() => { setExtraRunsValue('1'); setExtraRunsOpen({ type: 'b' }); }}>Bye</Button>
          <Button variant="outline" onClick={() => { setExtraRunsValue('1'); setExtraRunsOpen({ type: 'lb' }); }}>Leg Bye</Button>
          <Button variant="ghost" onClick={swapStrike}><ArrowLeftRight className="h-4 w-4 mr-1" /> Swap strike</Button>
          <Button variant="ghost" onClick={undoLast} className="text-destructive"><Undo2 className="h-4 w-4 mr-1" /> Undo last ball</Button>
        </div>

        {/* Recent balls of current over */}
        <RecentOver balls={balls} innings={innings} />
      </CardContent>

      {/* Add Player Dialog */}
      <Dialog open={!!addPlayerOpen} onOpenChange={(o) => !o && setAddPlayerOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Player</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="e.g. Virat Kohli" autoFocus />
          </div>
          <DialogFooter>
            <Button onClick={addPlayer}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wicket Dialog */}
      <Dialog open={wicketOpen} onOpenChange={setWicketOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Wicket Details</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Wicket Type</Label>
              <Select value={wicketType} onValueChange={setWicketType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bowled">Bowled</SelectItem>
                  <SelectItem value="caught">Caught</SelectItem>
                  <SelectItem value="lbw">LBW</SelectItem>
                  <SelectItem value="runout">Run Out</SelectItem>
                  <SelectItem value="stumped">Stumped</SelectItem>
                  <SelectItem value="hitwicket">Hit Wicket</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Dismissed Batter</Label>
              <div className="flex gap-1">
                <Select value={outPlayerId} onValueChange={setOutPlayerId}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {battingTeamPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="outline" onClick={() => setAddPlayerOpen({ team_id: battingTeamId, assignTo: 'out' })}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {(wicketType === 'caught' || wicketType === 'stumped' || wicketType === 'runout') && (
              <div className="space-y-1">
                <Label>Fielder</Label>
                <div className="flex gap-1">
                  <Select value={fielderId} onValueChange={setFielderId}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {bowlingTeamPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="outline" onClick={() => setAddPlayerOpen({ team_id: bowlingTeamId, assignTo: 'fielder' })}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWicketOpen(false)}>Cancel</Button>
            <Button onClick={submitWicket} className="bg-destructive text-destructive-foreground">Record Wicket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extras Dialog */}
      <Dialog open={!!extraRunsOpen} onOpenChange={(o) => !o && setExtraRunsOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {extraRunsOpen?.type === 'wd' && 'Wide'}
              {extraRunsOpen?.type === 'nb' && 'No Ball'}
              {extraRunsOpen?.type === 'b' && 'Byes'}
              {extraRunsOpen?.type === 'lb' && 'Leg Byes'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              {extraRunsOpen?.type === 'wd' && 'Extra runs taken (in addition to the 1 wide)'}
              {extraRunsOpen?.type === 'nb' && 'Runs off the bat on the no-ball'}
              {(extraRunsOpen?.type === 'b' || extraRunsOpen?.type === 'lb') && 'Runs taken'}
            </Label>
            <Input type="number" min={0} value={extraRunsValue} onChange={(e) => setExtraRunsValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={submitExtraRuns}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RecentOver({ balls, innings }: { balls: BallRow[]; innings: number }) {
  const inningsBalls = balls.filter(b => b.innings === innings);
  const last = inningsBalls[inningsBalls.length - 1];
  if (!last) return null;
  const currentOver = inningsBalls.filter(b => b.over_number === last.over_number);
  const label = (b: BallRow) => {
    if (b.is_wicket) return 'W';
    if (b.extra_type === 'wd') return `${b.extra_runs}wd`;
    if (b.extra_type === 'nb') return `${b.runs + b.extra_runs}nb`;
    if (b.extra_type === 'b') return `${b.runs}b`;
    if (b.extra_type === 'lb') return `${b.runs}lb`;
    return String(b.runs);
  };
  const cls = (b: BallRow) => {
    if (b.is_wicket) return 'bg-destructive text-destructive-foreground';
    if (b.runs === 4) return 'bg-cricket-gold text-foreground';
    if (b.runs === 6) return 'bg-primary text-primary-foreground';
    if (b.extra_type) return 'bg-muted text-muted-foreground';
    return 'bg-secondary text-secondary-foreground';
  };
  return (
    <div className="pt-2 border-t">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">This over</p>
      <div className="flex flex-wrap gap-1.5">
        {currentOver.map(b => (
          <span key={b.id} className={`inline-flex items-center justify-center min-w-9 h-9 px-2 rounded-full font-bold text-sm ${cls(b)}`}>
            {label(b)}
          </span>
        ))}
      </div>
    </div>
  );
}
