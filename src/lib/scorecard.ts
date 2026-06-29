// Aggregate ball-by-ball data into Cricbuzz-style scorecards.

export interface BallRow {
  id: string;
  innings: number;
  batting_team_id: string;
  bowling_team_id: string;
  over_number: number;
  ball_number: number;
  is_legal: boolean;
  striker_id: string | null;
  non_striker_id: string | null;
  bowler_id: string | null;
  runs: number;
  extra_type: string | null; // wd | nb | b | lb | p | null
  extra_runs: number;
  is_wicket: boolean;
  wicket_type: string | null;
  out_player_id: string | null;
  fielder_id: string | null;
  commentary: string | null;
  created_at: string;
}

export interface PlayerLite { id: string; name: string; team_id: string; }

export interface BatterStat {
  player_id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  sr: number;
  out: boolean;
  dismissal: string;
  order: number;
}

export interface BowlerStat {
  player_id: string;
  name: string;
  overs: string; // "4.2"
  maidens: number;
  runs: number;
  wickets: number;
  wides: number;
  noballs: number;
  econ: number;
  order: number;
}

export interface FallOfWicket {
  player_name: string;
  team_score: number;
  wicket_no: number;
  over_text: string;
}

export interface Partnership {
  batter_a: string;
  batter_b: string;
  runs: number;
  balls: number;
}

export interface InningsSummary {
  innings: number;
  batting_team_id: string;
  bowling_team_id: string;
  total_runs: number;
  total_wickets: number;
  legal_balls: number;
  overs_text: string; // "20.0" or "12.4"
  run_rate: number;
  extras: { byes: number; legbyes: number; wides: number; noballs: number; penalty: number; total: number };
  batters: BatterStat[];
  bowlers: BowlerStat[];
  fow: FallOfWicket[];
  partnerships: Partnership[];
}

const ballsToOversText = (legal: number) => {
  const o = Math.floor(legal / 6);
  const b = legal % 6;
  return `${o}.${b}`;
};

const nameOf = (players: Map<string, PlayerLite>, id: string | null) =>
  (id && players.get(id)?.name) || 'Unknown';

const dismissalText = (b: BallRow, players: Map<string, PlayerLite>): string => {
  const bowler = nameOf(players, b.bowler_id);
  const fielder = b.fielder_id ? nameOf(players, b.fielder_id) : '';
  switch (b.wicket_type) {
    case 'bowled': return `b ${bowler}`;
    case 'lbw': return `lbw b ${bowler}`;
    case 'caught': return `c ${fielder || 'sub'} b ${bowler}`;
    case 'stumped': return `st ${fielder || ''} b ${bowler}`.trim();
    case 'runout': return `run out (${fielder || ''})`.replace(' ()','');
    case 'hitwicket': return `hit wkt b ${bowler}`;
    default: return 'out';
  }
};

export function aggregateInnings(
  allBalls: BallRow[],
  players: Map<string, PlayerLite>,
  innings: number,
  battingTeamId: string,
  bowlingTeamId: string,
): InningsSummary {
  const balls = allBalls.filter(b => b.innings === innings).sort((a,b) => a.created_at.localeCompare(b.created_at));

  // Aggregators
  const battersMap = new Map<string, BatterStat>();
  const bowlersMap = new Map<string, BowlerStat>();
  let totalRuns = 0, totalWickets = 0, legalBalls = 0;
  const extras = { byes: 0, legbyes: 0, wides: 0, noballs: 0, penalty: 0, total: 0 };
  const fow: FallOfWicket[] = [];

  // Partnerships: track current pair runs/balls
  let currentPair: { aId: string|null; bId: string|null; runs: number; balls: number } | null = null;
  const partnerships: Partnership[] = [];

  let batterOrder = 0;
  let bowlerOrder = 0;
  const ensureBatter = (pid: string|null): BatterStat | null => {
    if (!pid) return null;
    if (!battersMap.has(pid)) {
      battersMap.set(pid, {
        player_id: pid, name: nameOf(players, pid),
        runs: 0, balls: 0, fours: 0, sixes: 0, sr: 0,
        out: false, dismissal: 'not out', order: batterOrder++,
      });
    }
    return battersMap.get(pid)!;
  };
  const ensureBowler = (pid: string|null): BowlerStat | null => {
    if (!pid) return null;
    if (!bowlersMap.has(pid)) {
      bowlersMap.set(pid, {
        player_id: pid, name: nameOf(players, pid),
        overs: '0.0', maidens: 0, runs: 0, wickets: 0, wides: 0, noballs: 0, econ: 0,
        order: bowlerOrder++,
      });
    }
    return bowlersMap.get(pid)!;
  };

  // For maiden calc per bowler per over
  const overTracker = new Map<string, { over: number; legal: number; runs: number }>();

  for (const b of balls) {
    const striker = ensureBatter(b.striker_id);
    const bowler = ensureBowler(b.bowler_id);

    // Initialize / update partnership
    if (!currentPair || currentPair.aId !== b.striker_id && currentPair.bId !== b.striker_id
        || (b.non_striker_id && currentPair.aId !== b.non_striker_id && currentPair.bId !== b.non_striker_id)) {
      if (b.striker_id && b.non_striker_id) {
        const exists = currentPair && (
          (currentPair.aId === b.striker_id && currentPair.bId === b.non_striker_id) ||
          (currentPair.aId === b.non_striker_id && currentPair.bId === b.striker_id)
        );
        if (!exists) {
          if (currentPair) {
            partnerships.push({
              batter_a: nameOf(players, currentPair.aId),
              batter_b: nameOf(players, currentPair.bId),
              runs: currentPair.runs, balls: currentPair.balls,
            });
          }
          currentPair = { aId: b.striker_id, bId: b.non_striker_id, runs: 0, balls: 0 };
        }
      }
    }

    const ballRuns = (b.runs || 0) + (b.extra_runs || 0);
    totalRuns += ballRuns;

    // Extras
    if (b.extra_type === 'wd') extras.wides += ballRuns;
    else if (b.extra_type === 'nb') { extras.noballs += b.extra_runs; }
    else if (b.extra_type === 'b') extras.byes += b.runs;
    else if (b.extra_type === 'lb') extras.legbyes += b.runs;
    else if (b.extra_type === 'p') extras.penalty += b.runs;

    // Batter stats
    if (striker) {
      const facedBall = b.is_legal && b.extra_type !== 'b' && b.extra_type !== 'lb' && b.extra_type !== 'wd';
      if (facedBall) striker.balls += 1;
      // Runs off bat: extra_type null OR nb (off-bat portion in `runs`)
      if (b.extra_type === null || b.extra_type === 'nb') {
        striker.runs += b.runs;
        if (b.runs === 4) striker.fours += 1;
        if (b.runs === 6) striker.sixes += 1;
      }
    }

    // Bowler stats
    if (bowler) {
      // Runs against bowler: everything except byes/legbyes/penalty
      const bowlerConceded = (b.extra_type === 'b' || b.extra_type === 'lb' || b.extra_type === 'p')
        ? 0 : ballRuns;
      bowler.runs += bowlerConceded;
      if (b.extra_type === 'wd') bowler.wides += ballRuns;
      if (b.extra_type === 'nb') bowler.noballs += 1;

      // Maiden tracking
      let tr = overTracker.get(b.bowler_id!);
      if (!tr || tr.over !== b.over_number) {
        if (tr && tr.legal === 6 && tr.runs === 0) bowler.maidens += 1;
        tr = { over: b.over_number, legal: 0, runs: 0 };
        overTracker.set(b.bowler_id!, tr);
      }
      if (b.is_legal) tr.legal += 1;
      tr.runs += bowlerConceded;
    }

    // Legal balls / overs
    if (b.is_legal) legalBalls += 1;

    // Partnership accumulate
    if (currentPair) {
      currentPair.runs += ballRuns;
      if (b.is_legal) currentPair.balls += 1;
    }

    // Wicket
    if (b.is_wicket) {
      totalWickets += 1;
      const outPid = b.out_player_id || b.striker_id;
      const out = ensureBatter(outPid);
      if (out) {
        out.out = true;
        out.dismissal = dismissalText(b, players);
      }
      if (bowler && b.wicket_type && b.wicket_type !== 'runout') {
        bowler.wickets += 1;
      }
      fow.push({
        player_name: nameOf(players, outPid),
        team_score: totalRuns,
        wicket_no: totalWickets,
        over_text: `${b.over_number}.${b.ball_number}`,
      });
      // Close partnership on wicket
      if (currentPair) {
        partnerships.push({
          batter_a: nameOf(players, currentPair.aId),
          batter_b: nameOf(players, currentPair.bId),
          runs: currentPair.runs, balls: currentPair.balls,
        });
        currentPair = null;
      }
    }
  }

  // Final open partnership
  if (currentPair && (currentPair.runs > 0 || currentPair.balls > 0)) {
    partnerships.push({
      batter_a: nameOf(players, currentPair.aId),
      batter_b: nameOf(players, currentPair.bId),
      runs: currentPair.runs, balls: currentPair.balls,
    });
  }

  // Last over maiden check
  for (const [pid, tr] of overTracker) {
    if (tr.legal === 6 && tr.runs === 0) {
      const bow = bowlersMap.get(pid);
      if (bow) bow.maidens += 1;
    }
  }

  // Finalize batter SR
  const batters = Array.from(battersMap.values())
    .sort((a,b) => a.order - b.order)
    .map(b => ({ ...b, sr: b.balls > 0 ? +(b.runs * 100 / b.balls).toFixed(2) : 0 }));

  // Finalize bowler overs/econ
  const bowlers = Array.from(bowlersMap.values())
    .sort((a,b) => a.order - b.order)
    .map(b => {
      // recompute legal balls bowled
      const bowlerBalls = balls.filter(x => x.bowler_id === b.player_id && x.is_legal).length;
      const overs = ballsToOversText(bowlerBalls);
      const overEquivalent = bowlerBalls / 6;
      const econ = overEquivalent > 0 ? +(b.runs / overEquivalent).toFixed(2) : 0;
      return { ...b, overs, econ };
    });

  extras.total = extras.byes + extras.legbyes + extras.wides + extras.noballs + extras.penalty;

  const overEq = legalBalls / 6;
  return {
    innings,
    batting_team_id: battingTeamId,
    bowling_team_id: bowlingTeamId,
    total_runs: totalRuns,
    total_wickets: totalWickets,
    legal_balls: legalBalls,
    overs_text: ballsToOversText(legalBalls),
    run_rate: overEq > 0 ? +(totalRuns / overEq).toFixed(2) : 0,
    extras,
    batters,
    bowlers,
    fow,
    partnerships,
  };
}

/**
 * Compute the next ball's over_number / ball_number from the most recent
 * legal-ball state for this innings.
 */
export function nextBallPosition(balls: BallRow[], innings: number) {
  const legal = balls.filter(b => b.innings === innings && b.is_legal);
  if (legal.length === 0) return { over_number: 0, ball_number: 1 };
  const last = legal[legal.length - 1];
  if (last.ball_number >= 6) {
    return { over_number: last.over_number + 1, ball_number: 1 };
  }
  return { over_number: last.over_number, ball_number: last.ball_number + 1 };
}
