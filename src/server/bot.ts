import { getUnitDef, unitCounts } from '../shared/content';
import { BENCH_SIZE } from '../shared/types';
import type { GamePlayer, OwnedUnit } from './game';

export type BotAction =
  | { kind: 'buy'; index: number }
  | { kind: 'reroll' }
  | { kind: 'xp' }
  | { kind: 'sell'; uid: string }
  | { kind: 'place'; uid: string; x: number; y: number }
  | { kind: 'bench'; uid: string };

function duplicateBonus(units: OwnedUnit[], defId: string): number {
  const count = units.filter((u) => u.defId === defId && u.star === 1).length;
  if (count >= 2) return 50;
  if (count === 1) return 18;
  return 0;
}

function offerScore(player: GamePlayer, defId: string): number {
  const def = getUnitDef(defId);
  const units = [...player.board, ...player.bench];
  const counts = unitCounts(units);
  const raceCount = counts.races[def.race] ?? 0;
  const classCount = counts.classes[def.unitClass] ?? 0;
  let score = def.cost * 14 + duplicateBonus(units, defId);
  if (raceCount === 1 || raceCount === 3) score += 10;
  if (classCount === 1 || classCount === 3) score += 8;
  if (raceCount >= 2) score += 5;
  if (player.level <= 4 && def.cost === 1) score += 6;
  return score + Math.random() * 6;
}

function unitPower(unit: OwnedUnit): number {
  const def = getUnitDef(unit.defId);
  return def.cost * 10 + (unit.star - 1) * 45 + def.hp / 80 + def.attack / 6;
}

function weakestBenchUnit(player: GamePlayer, exclude: Set<string>): OwnedUnit | null {
  const bench = player.bench.filter((u) => !exclude.has(u.uid));
  if (bench.length === 0) return null;
  const sorted = [...bench].sort((a, b) => {
    const aPair = bench.filter((u) => u.defId === a.defId && u.star === a.star).length;
    const bPair = bench.filter((u) => u.defId === b.defId && u.star === b.star).length;
    if (aPair !== bPair) return aPair - bPair;
    return unitPower(a) - unitPower(b);
  });
  return sorted[0] ?? null;
}

export function planBotEconomy(player: GamePlayer, round: number): BotAction[] {
  const actions: BotAction[] = [];
  let gold = player.gold;

  if (player.level < 8 && gold >= 9 && Math.random() < 0.72) {
    actions.push({ kind: 'xp' });
    gold -= 4;
  }

  let benchCount = player.bench.length;
  const sold = new Set<string>();
  while (benchCount >= BENCH_SIZE) {
    const weak = weakestBenchUnit(player, sold);
    if (!weak) break;
    sold.add(weak.uid);
    actions.push({ kind: 'sell', uid: weak.uid });
    benchCount -= 1;
    if (sold.size > 3) break;
  }

  const offers = player.shop
    .map((defId, index) => (defId ? { defId, index, score: offerScore(player, defId) } : null))
    .filter((offer): offer is { defId: string; index: number; score: number } => Boolean(offer))
    .sort((a, b) => b.score - a.score);

  let benchSlots = BENCH_SIZE - benchCount;
  let bought = 0;
  for (const offer of offers) {
    const def = getUnitDef(offer.defId);
    const copies = [...player.board, ...player.bench].filter((u) => u.defId === offer.defId && u.star === 1).length;
    const willCombine = copies >= 2;
    if (gold < def.cost) continue;
    if (benchSlots <= 0 && !willCombine) continue;
    if (gold - def.cost < 0) continue;
    actions.push({ kind: 'buy', index: offer.index });
    gold -= def.cost;
    bought += 1;
    if (!willCombine) benchSlots -= 1;
  }

  if (bought === 0 && gold >= 5 && round >= 2 && Math.random() < 0.55) {
    actions.push({ kind: 'reroll' });
  }

  return actions;
}

function freeCells(player: GamePlayer, occupied: Set<string>): { x: number; y: number }[] {
  const cols = [3, 4, 2, 5, 1, 6, 0, 7];
  const meleeRows = [4, 5];
  const rangedRows = [7, 6];
  const result: { x: number; y: number }[] = [];
  for (const y of [...meleeRows, ...rangedRows]) {
    for (const x of cols) {
      const key = `${x}:${y}`;
      if (!occupied.has(key)) {
        occupied.add(key);
        result.push({ x, y });
      }
    }
  }
  return result;
}

function takeCell(range: number, cells: { x: number; y: number }[]): { x: number; y: number } | null {
  const preferred = range <= 1 ? cells.find((cell) => cell.y <= 5) : cells.find((cell) => cell.y >= 6);
  const cell = preferred ?? cells[0];
  if (!cell) return null;
  const index = cells.indexOf(cell);
  if (index >= 0) cells.splice(index, 1);
  return cell;
}

export function planBotPlacement(player: GamePlayer): BotAction[] {
  const actions: BotAction[] = [];
  const occupied = new Set(player.board.map((u) => `${u.x}:${u.y}`));
  const cells = freeCells(player, occupied);
  const available = Math.max(0, player.level - player.board.length);
  if (available === 0) return actions;

  const candidates = [...player.bench]
    .sort((a, b) => unitPower(b) - unitPower(a))
    .slice(0, available);

  for (const unit of candidates) {
    const def = getUnitDef(unit.defId);
    const cell = takeCell(def.range, cells);
    if (!cell) break;
    actions.push({ kind: 'place', uid: unit.uid, x: cell.x, y: cell.y });
  }
  return actions;
}
