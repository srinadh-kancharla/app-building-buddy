import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { BallRow, PlayerLite, aggregateInnings, InningsSummary } from '@/lib/scorecard';

interface Props {
  balls: BallRow[];
  players: PlayerLite[];
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
}

export default function Scorecard({ balls, players, teamAId, teamBId, teamAName, teamBName }: Props) {
  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const innings1Balls = balls.filter(b => b.innings === 1);
  const innings2Balls = balls.filter(b => b.innings === 2);

  const inn1: InningsSummary | null = innings1Balls.length > 0 ? aggregateInnings(
    balls, playerMap, 1,
    innings1Balls[0].batting_team_id, innings1Balls[0].bowling_team_id,
  ) : null;

  const inn2: InningsSummary | null = innings2Balls.length > 0 ? aggregateInnings(
    balls, playerMap, 2,
    innings2Balls[0].batting_team_id, innings2Balls[0].bowling_team_id,
  ) : null;

  if (!inn1 && !inn2) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-10 text-center text-muted-foreground">
          No balls bowled yet. The scorecard will appear here once scoring begins.
        </CardContent>
      </Card>
    );
  }

  const teamName = (id: string) => id === teamAId ? teamAName : teamBName;

  const renderInnings = (inn: InningsSummary) => (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="rounded-t-md bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
        <h3 className="font-display tracking-wide text-lg">{teamName(inn.batting_team_id)}</h3>
        <p className="font-bold text-lg">
          {inn.total_runs}-{inn.total_wickets} <span className="font-normal text-sm opacity-90">({inn.overs_text} Ov, RR {inn.run_rate})</span>
        </p>
      </div>

      {/* Batting */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[42%]">Batter</TableHead>
              <TableHead className="text-right">R</TableHead>
              <TableHead className="text-right">B</TableHead>
              <TableHead className="text-right">4s</TableHead>
              <TableHead className="text-right">6s</TableHead>
              <TableHead className="text-right">SR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inn.batters.map(b => (
              <TableRow key={b.player_id}>
                <TableCell>
                  <div className="font-medium text-primary">{b.name}{!b.out && <span className="text-muted-foreground"> *</span>}</div>
                  <div className="text-xs text-muted-foreground">{b.dismissal}</div>
                </TableCell>
                <TableCell className="text-right font-bold">{b.runs}</TableCell>
                <TableCell className="text-right">{b.balls}</TableCell>
                <TableCell className="text-right">{b.fours}</TableCell>
                <TableCell className="text-right">{b.sixes}</TableCell>
                <TableCell className="text-right">{b.sr.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30">
              <TableCell className="font-semibold">Extras</TableCell>
              <TableCell colSpan={5} className="font-semibold">
                {inn.extras.total} <span className="font-normal text-muted-foreground text-xs">
                  (b {inn.extras.byes}, lb {inn.extras.legbyes}, w {inn.extras.wides}, nb {inn.extras.noballs}, p {inn.extras.penalty})
                </span>
              </TableCell>
            </TableRow>
            <TableRow className="bg-muted/50">
              <TableCell className="font-bold">Total</TableCell>
              <TableCell colSpan={5} className="font-bold">
                {inn.total_runs}-{inn.total_wickets} <span className="text-xs font-normal text-muted-foreground">({inn.overs_text} Overs, RR: {inn.run_rate})</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Bowling */}
      {inn.bowlers.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[42%]">Bowler</TableHead>
                <TableHead className="text-right">O</TableHead>
                <TableHead className="text-right">M</TableHead>
                <TableHead className="text-right">R</TableHead>
                <TableHead className="text-right">W</TableHead>
                <TableHead className="text-right">NB</TableHead>
                <TableHead className="text-right">WD</TableHead>
                <TableHead className="text-right">ECO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inn.bowlers.map(b => (
                <TableRow key={b.player_id}>
                  <TableCell className="font-medium text-primary">{b.name}</TableCell>
                  <TableCell className="text-right">{b.overs}</TableCell>
                  <TableCell className="text-right">{b.maidens}</TableCell>
                  <TableCell className="text-right">{b.runs}</TableCell>
                  <TableCell className="text-right font-bold">{b.wickets}</TableCell>
                  <TableCell className="text-right">{b.noballs}</TableCell>
                  <TableCell className="text-right">{b.wides}</TableCell>
                  <TableCell className="text-right">{b.econ.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Fall of Wickets */}
      {inn.fow.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Fall of Wickets</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Over</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inn.fow.map((w, i) => (
                <TableRow key={i}>
                  <TableCell className="text-primary">{w.player_name}</TableCell>
                  <TableCell className="text-right">{w.team_score}-{w.wicket_no}</TableCell>
                  <TableCell className="text-right">{w.over_text}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Partnerships */}
      {inn.partnerships.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow><TableHead colSpan={3}>Partnerships</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {inn.partnerships.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="text-primary">{p.batter_a}</TableCell>
                  <TableCell className="text-center font-medium">{p.runs}({p.balls})</TableCell>
                  <TableCell className="text-right text-primary">{p.batter_b}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  const tabsList = [inn1, inn2].filter(Boolean) as InningsSummary[];
  if (tabsList.length === 1) {
    return <div>{renderInnings(tabsList[0])}</div>;
  }
  return (
    <Tabs defaultValue={`inn${tabsList[tabsList.length - 1].innings}`}>
      <TabsList>
        {tabsList.map(inn => (
          <TabsTrigger key={inn.innings} value={`inn${inn.innings}`}>
            {teamName(inn.batting_team_id)} ({inn.innings === 1 ? '1st' : '2nd'} Inn)
          </TabsTrigger>
        ))}
      </TabsList>
      {tabsList.map(inn => (
        <TabsContent key={inn.innings} value={`inn${inn.innings}`} className="mt-4">
          {renderInnings(inn)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
