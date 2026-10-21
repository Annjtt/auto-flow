import type { Race, SynergyDef, SynergyStatus, UnitClass, UnitDef } from './types';
import { CLASS_NAMES, RACE_NAMES } from './types';

export const UNITS: UnitDef[] = [
  {
    id: 'squire', name: 'Оруженосец', race: 'human', unitClass: 'warrior', cost: 1,
    hp: 560, attack: 50, armor: 8, attackSpeed: 0.75, range: 1, maxMana: 70,
    ability: { name: 'Удар щитом', description: 'Наносит 60 урона и оглушает цель на 1.2 сек.', kind: 'stun', power: 60, duration: 1.2 },
    flavor: 'Щит больше, чем его вера в себя.',
  },
  {
    id: 'lightfoot', name: 'Ловкач', race: 'human', unitClass: 'hunter', cost: 2,
    hp: 640, attack: 66, armor: 5, attackSpeed: 0.85, range: 1, maxMana: 70,
    ability: { name: 'Удар в спину', description: 'Наносит 150 урона цели.', kind: 'nuke', power: 150 },
    flavor: 'Всегда заходит с той стороны, где нет глаз.',
  },
  {
    id: 'arcanist', name: 'Арканист', race: 'human', unitClass: 'mage', cost: 3,
    hp: 620, attack: 58, armor: 4, attackSpeed: 0.7, range: 3, maxMana: 100,
    ability: { name: 'Аркан Нова', description: 'Наносит 190 урона всем врагам в радиусе 2.', kind: 'aoe', power: 190, radius: 2 },
    flavor: 'Изучает запретное, но очень полезное.',
  },
  {
    id: 'paladin', name: 'Паладин', race: 'human', unitClass: 'warrior', cost: 4,
    hp: 1120, attack: 82, armor: 12, attackSpeed: 0.65, range: 1, maxMana: 110,
    ability: { name: 'Святой оплот', description: 'Даёт всем союзникам щит на 220 ед.', kind: 'shield', power: 220, secondary: 99 },
    flavor: 'Свет не спрашивает, удобно ли это.',
  },
  {
    id: 'ghoul', name: 'Упырь', race: 'undead', unitClass: 'warrior', cost: 1,
    hp: 610, attack: 54, armor: 5, attackSpeed: 0.72, range: 1, maxMana: 60,
    ability: { name: 'Кровавый голод', description: 'Ускоряет атаки на 45% на 4 сек.', kind: 'buff', power: 45, duration: 4 },
    flavor: 'Голод — единственный надёжный союзник.',
  },
  {
    id: 'crypt_archer', name: 'Склепный лучник', race: 'undead', unitClass: 'hunter', cost: 2,
    hp: 570, attack: 72, armor: 4, attackSpeed: 0.85, range: 3, maxMana: 80,
    ability: { name: 'Залп костей', description: 'Наносит 85 урона врагам в радиусе 1.5.', kind: 'aoe', power: 85, radius: 1.5 },
    flavor: 'Стреляет даже после смерти. Особенно после.',
  },
  {
    id: 'necromancer', name: 'Некромант', race: 'undead', unitClass: 'mage', cost: 3,
    hp: 710, attack: 55, armor: 5, attackSpeed: 0.7, range: 3, maxMana: 100,
    ability: { name: 'Похищение жизни', description: 'Наносит 155 урона и лечит себя на 155.', kind: 'drain', power: 155 },
    flavor: 'Чужая жизнь всегда была его ресурсом.',
  },
  {
    id: 'bone_dragon', name: 'Костяной дракон', race: 'undead', unitClass: 'assassin', cost: 5,
    hp: 1580, attack: 118, armor: 10, attackSpeed: 0.7, range: 1, maxMana: 120,
    ability: { name: 'Дыхание зимы', description: 'Наносит 310 урона в радиусе 2 и оглушает на 1.4 сек.', kind: 'aoe', power: 310, radius: 2, duration: 1.4 },
    flavor: 'Кости помнят полёт лучше, чем плоть.',
  },
  {
    id: 'scrapbot', name: 'Железяка', race: 'mech', unitClass: 'warrior', cost: 1,
    hp: 530, attack: 44, armor: 10, attackSpeed: 0.8, range: 1, maxMana: 60,
    ability: { name: 'Ремонт', description: 'Восстанавливает себе 170 здоровья.', kind: 'heal', power: 170, secondary: 1 },
    flavor: 'Собран из того, что не жалко. Работает лучше многих.',
  },
  {
    id: 'steamgunner', name: 'Паровой стрелок', race: 'mech', unitClass: 'hunter', cost: 2,
    hp: 650, attack: 61, armor: 8, attackSpeed: 0.72, range: 3, maxMana: 80,
    ability: { name: 'Шквал огня', description: 'Три выстрела по 55 урона в случайных врагов.', kind: 'chain', power: 55, secondary: 3 },
    flavor: 'Давление растёт. Как и его нетерпение.',
  },
  {
    id: 'sparkmage', name: 'Искромант', race: 'mech', unitClass: 'mage', cost: 3,
    hp: 660, attack: 57, armor: 6, attackSpeed: 0.75, range: 3, maxMana: 90,
    ability: { name: 'Цепная молния', description: 'Наносит 115 урона трём ближайшим врагам.', kind: 'chain', power: 115, secondary: 3 },
    flavor: 'Технически это не магия. Технически.',
  },
  {
    id: 'siege_colossus', name: 'Осадный колосс', race: 'mech', unitClass: 'warrior', cost: 5,
    hp: 1850, attack: 102, armor: 16, attackSpeed: 0.5, range: 2, maxMana: 130,
    ability: { name: 'Ракетный залп', description: 'Наносит 280 урона врагам в радиусе 2.5.', kind: 'aoe', power: 280, radius: 2.5 },
    flavor: 'Городская стена с расписанием поставок.',
  },
  {
    id: 'direwolf', name: 'Лютоволк', race: 'beast', unitClass: 'assassin', cost: 1,
    hp: 490, attack: 60, armor: 3, attackSpeed: 0.95, range: 1, maxMana: 65,
    ability: { name: 'Разрывание', description: 'Наносит 120 урона цели.', kind: 'nuke', power: 120 },
    flavor: 'Стая из одного волка — уже стая.',
  },
  {
    id: 'boar_rider', name: 'Кабаний наездник', race: 'beast', unitClass: 'hunter', cost: 2,
    hp: 760, attack: 64, armor: 6, attackSpeed: 0.75, range: 1, maxMana: 75,
    ability: { name: 'Таран', description: 'Наносит 110 урона и оглушает на 1 сек.', kind: 'stun', power: 110, duration: 1 },
    flavor: 'Кабан выбрал всадника сам. Спросить забыли.',
  },
  {
    id: 'owl_sage', name: 'Совиный мудрец', race: 'beast', unitClass: 'mage', cost: 3,
    hp: 630, attack: 50, armor: 4, attackSpeed: 0.7, range: 3, maxMana: 95,
    ability: { name: 'Совет леса', description: 'Лечит всех союзников на 105 ед.', kind: 'heal', power: 105, secondary: 99 },
    flavor: 'Мудрость приходит с перьями.',
  },
  {
    id: 'elder_bear', name: 'Древний медведь', race: 'beast', unitClass: 'warrior', cost: 4,
    hp: 1280, attack: 90, armor: 8, attackSpeed: 0.6, range: 1, maxMana: 110,
    ability: { name: 'Рёв', description: 'Даёт союзникам +30% скорости атаки на 5 сек.', kind: 'buff', power: 30, duration: 5 },
    flavor: 'Сначала рёв. Потом уже объяснения.',
  },
  {
    id: 'imp', name: 'Бес', race: 'demon', unitClass: 'mage', cost: 1,
    hp: 430, attack: 47, armor: 2, attackSpeed: 0.8, range: 3, maxMana: 60,
    ability: { name: 'Огненный шар', description: 'Наносит 125 урона цели.', kind: 'nuke', power: 125 },
    flavor: 'Маленький, но крайне убедительный.',
  },
  {
    id: 'hellhound', name: 'Адский пёс', race: 'demon', unitClass: 'assassin', cost: 2,
    hp: 610, attack: 74, armor: 4, attackSpeed: 0.95, range: 1, maxMana: 75,
    ability: { name: 'Пламенное дыхание', description: 'Наносит 120 урона в радиусе 1.5.', kind: 'aoe', power: 120, radius: 1.5 },
    flavor: 'Приносит тепло в дом. Вместе с домом.',
  },
  {
    id: 'doomguard', name: 'Страж рока', race: 'demon', unitClass: 'warrior', cost: 3,
    hp: 910, attack: 76, armor: 8, attackSpeed: 0.65, range: 1, maxMana: 90,
    ability: { name: 'Демонический рассекатель', description: 'Наносит 150 урона врагам в радиусе 1.5.', kind: 'aoe', power: 150, radius: 1.5 },
    flavor: 'Он не приходит с миром. Он приходит вместо него.',
  },
  {
    id: 'pit_fiend', name: 'Исчадие бездны', race: 'demon', unitClass: 'hunter', cost: 4,
    hp: 980, attack: 96, armor: 6, attackSpeed: 0.8, range: 3, maxMana: 110,
    ability: { name: 'Адское пламя', description: 'Наносит 235 урона в радиусе 2.5.', kind: 'aoe', power: 235, radius: 2.5 },
    flavor: 'Стрелять ему даже не обязательно. Но он любит.',
  },
  {
    id: 'scout', name: 'Разведчица', race: 'elf', unitClass: 'hunter', cost: 1,
    hp: 460, attack: 55, armor: 3, attackSpeed: 0.9, range: 3, maxMana: 70,
    ability: { name: 'Пронзающая стрела', description: 'Наносит 105 урона цели.', kind: 'nuke', power: 105 },
    flavor: 'Видит всё. Попадает почти во всё.',
  },
  {
    id: 'blade_dancer', name: 'Танцующая с клинками', race: 'elf', unitClass: 'assassin', cost: 2,
    hp: 590, attack: 72, armor: 4, attackSpeed: 1.0, range: 1, maxMana: 70,
    ability: { name: 'Вихрь клинков', description: 'Наносит 95 урона врагам в радиусе 1.5.', kind: 'aoe', power: 95, radius: 1.5 },
    flavor: 'Каждый шаг — приглашение. Каждый выпад — ответ.',
  },
  {
    id: 'starweaver', name: 'Ткачиха звёзд', race: 'elf', unitClass: 'mage', cost: 3,
    hp: 610, attack: 64, armor: 4, attackSpeed: 0.8, range: 3, maxMana: 95,
    ability: { name: 'Звёздный свет', description: 'Наносит 170 урона и даёт себе щит на 160.', kind: 'shield', power: 170, secondary: 160 },
    flavor: 'Плетёт свет так, будто он принадлежит ей.',
  },
  {
    id: 'ancient_warden', name: 'Древний страж', race: 'elf', unitClass: 'warrior', cost: 4,
    hp: 1220, attack: 84, armor: 14, attackSpeed: 0.6, range: 1, maxMana: 100,
    ability: { name: 'Кора-щит', description: 'Даёт себе и двум союзникам щит на 180.', kind: 'shield', power: 180, secondary: 3 },
    flavor: 'Он помнит лес ещё до того, как лес стал лесом.',
  },
];

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

export const SYNERGIES: SynergyDef[] = [
  {
    key: 'human', name: RACE_NAMES.human, group: 'race', ref: 'human', thresholds: [2, 4],
    effects: ['Все союзники получают +15% к максимальному здоровью.', 'Все союзники получают +30% к максимальному здоровью.'],
  },
  {
    key: 'undead', name: RACE_NAMES.undead, group: 'race', ref: 'undead', thresholds: [2, 4],
    effects: ['Враги теряют 2 брони.', 'Враги теряют 5 брони.'],
  },
  {
    key: 'mech', name: RACE_NAMES.mech, group: 'race', ref: 'mech', thresholds: [2, 4],
    effects: ['Мехи получают +5 брони.', 'Мехи получают +12 брони.'],
  },
  {
    key: 'beast', name: RACE_NAMES.beast, group: 'race', ref: 'beast', thresholds: [2, 4],
    effects: ['Все союзники получают +10% скорости атаки.', 'Все союзники получают +25% скорости атаки.'],
  },
  {
    key: 'demon', name: RACE_NAMES.demon, group: 'race', ref: 'demon', thresholds: [2, 4],
    effects: ['Демоны получают 15% вампиризма.', 'Демоны получают 30% вампиризма.'],
  },
  {
    key: 'elf', name: RACE_NAMES.elf, group: 'race', ref: 'elf', thresholds: [2, 4],
    effects: ['Все союзники получают 12% уклонения.', 'Все союзники получают 25% уклонения.'],
  },
  {
    key: 'warrior', name: CLASS_NAMES.warrior, group: 'class', ref: 'warrior', thresholds: [2, 4],
    effects: ['Воины получают +5 брони.', 'Воины получают +12 брони.'],
  },
  {
    key: 'mage', name: CLASS_NAMES.mage, group: 'class', ref: 'mage', thresholds: [2, 4],
    effects: ['Маги получают +25% силы способностей.', 'Маги получают +60% силы способностей.'],
  },
  {
    key: 'hunter', name: CLASS_NAMES.hunter, group: 'class', ref: 'hunter', thresholds: [2, 4],
    effects: ['Охотники получают +15% к атаке.', 'Охотники получают +35% к атаке.'],
  },
  {
    key: 'assassin', name: CLASS_NAMES.assassin, group: 'class', ref: 'assassin', thresholds: [2, 4],
    effects: ['Убийцы получают +15% к урону.', 'Убийцы получают +35% к урону.'],
  },
];

export const SYNERGY_BY_KEY: Record<string, SynergyDef> = Object.fromEntries(SYNERGIES.map((s) => [s.key, s]));

export function getUnitDef(id: string): UnitDef {
  const def = UNIT_BY_ID[id];
  if (!def) throw new Error(`Unknown unit: ${id}`);
  return def;
}

export function unitCounts(units: { defId: string }[]): { races: Record<string, number>; classes: Record<string, number> } {
  const races: Record<string, number> = {};
  const classes: Record<string, number> = {};
  for (const unit of units) {
    const def = UNIT_BY_ID[unit.defId];
    if (!def) continue;
    races[def.race] = (races[def.race] ?? 0) + 1;
    classes[def.unitClass] = (classes[def.unitClass] ?? 0) + 1;
  }
  return { races, classes };
}

export function computeSynergies(units: { defId: string }[]): SynergyStatus[] {
  const counts = unitCounts(units);
  const result: SynergyStatus[] = [];
  for (const synergy of SYNERGIES) {
    const count = synergy.group === 'race' ? (counts.races[synergy.ref] ?? 0) : (counts.classes[synergy.ref] ?? 0);
    if (count <= 0) continue;
    let tier = 0;
    for (let i = 0; i < synergy.thresholds.length; i++) {
      if (count >= synergy.thresholds[i]) tier = i + 1;
    }
    result.push({
      key: synergy.key,
      name: synergy.name,
      group: synergy.group,
      count,
      threshold: tier > 0 ? synergy.thresholds[tier - 1] : 0,
      next: tier < synergy.thresholds.length ? synergy.thresholds[tier] : null,
      active: tier > 0,
      tier,
      effects: synergy.effects,
    });
  }
  result.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.count - a.count;
  });
  return result;
}

export function synergyBonus(units: { defId: string }[], group: 'race' | 'class', key: string): number {
  const counts = unitCounts(units);
  const synergy = SYNERGY_BY_KEY[key];
  if (!synergy) return 0;
  const count = group === 'race' ? (counts.races[synergy.ref] ?? 0) : (counts.classes[synergy.ref] ?? 0);
  let tier = 0;
  for (let i = 0; i < synergy.thresholds.length; i++) {
    if (count >= synergy.thresholds[i]) tier = i + 1;
  }
  return tier;
}

export interface TeamBonuses {
  hpMult: number;
  attackSpeedMult: number;
  armorAdd: number;
  dodge: number;
  spellPower: number;
  lifesteal: number;
  damageMult: number;
  enemyArmorReduction: number;
}

export function createTeamBonuses(): TeamBonuses {
  return {
    hpMult: 1,
    attackSpeedMult: 1,
    armorAdd: 0,
    dodge: 0,
    spellPower: 1,
    lifesteal: 0,
    damageMult: 1,
    enemyArmorReduction: 0,
  };
}

export function applySynergiesToUnit(
  bonus: TeamBonuses,
  race: Race,
  unitClass: UnitClass,
  units: { defId: string }[],
): TeamBonuses {
  const result = { ...bonus };
  const human = synergyBonus(units, 'race', 'human');
  if (human === 1) result.hpMult *= 1.15;
  if (human === 2) result.hpMult *= 1.3;

  const beast = synergyBonus(units, 'race', 'beast');
  if (beast === 1) result.attackSpeedMult *= 1.1;
  if (beast === 2) result.attackSpeedMult *= 1.25;

  const elf = synergyBonus(units, 'race', 'elf');
  if (elf === 1) result.dodge += 0.12;
  if (elf === 2) result.dodge += 0.25;

  if (race === 'mech') {
    const mech = synergyBonus(units, 'race', 'mech');
    if (mech === 1) result.armorAdd += 5;
    if (mech === 2) result.armorAdd += 12;
  }
  if (race === 'demon') {
    const demon = synergyBonus(units, 'race', 'demon');
    if (demon === 1) result.lifesteal += 0.15;
    if (demon === 2) result.lifesteal += 0.3;
  }
  if (unitClass === 'warrior') {
    const warrior = synergyBonus(units, 'class', 'warrior');
    if (warrior === 1) result.armorAdd += 5;
    if (warrior === 2) result.armorAdd += 12;
  }
  if (unitClass === 'mage') {
    const mage = synergyBonus(units, 'class', 'mage');
    if (mage === 1) result.spellPower *= 1.25;
    if (mage === 2) result.spellPower *= 1.6;
  }
  if (unitClass === 'hunter') {
    const hunter = synergyBonus(units, 'class', 'hunter');
    if (hunter === 1) result.damageMult *= 1.15;
    if (hunter === 2) result.damageMult *= 1.35;
  }
  if (unitClass === 'assassin') {
    const assassin = synergyBonus(units, 'class', 'assassin');
    if (assassin === 1) result.damageMult *= 1.15;
    if (assassin === 2) result.damageMult *= 1.35;
  }

  const undead = synergyBonus(units, 'race', 'undead');
  if (undead === 1) result.enemyArmorReduction += 2;
  if (undead === 2) result.enemyArmorReduction += 5;

  return result;
}

export function unitLabel(id: string): string {
  return UNIT_BY_ID[id]?.name ?? id;
}
