import type { GameMeta } from './types'

// 게임 추가 = 여기에 한 줄 등록 (아이콘은 shared/GameIcon.vue에 slug별로 정의)
// titleKey는 shared/i18n.ts의 번역 키
export const GAMES: GameMeta[] = [
  {
    slug: 'suika',
    titleKey: 'game.suika',
    loader: () => import('./suika'),
  },
  {
    slug: 'blockblast',
    titleKey: 'game.blockblast',
    loader: () => import('./blockblast'),
  },
  {
    slug: 'brick',
    titleKey: 'game.brick',
    loader: () => import('./brick'),
  },
  {
    slug: 'fruit2048',
    titleKey: 'game.fruit2048',
    loader: () => import('./fruit2048'),
  },
  {
    slug: 'runner',
    titleKey: 'game.runner',
    loader: () => import('./runner'),
  },
  {
    slug: 'dodge',
    titleKey: 'game.dodge',
    loader: () => import('./dodge'),
  },
  {
    slug: 'survivor',
    titleKey: 'game.survivor',
    loader: () => import('./survivor'),
  },
  {
    slug: 'merge',
    titleKey: 'game.merge',
    loader: () => import('./merge'),
  },
  {
    slug: 'match3',
    titleKey: 'game.match3',
    loader: () => import('./match3'),
  },
  {
    slug: 'tripeaks',
    titleKey: 'game.tripeaks',
    loader: () => import('./tripeaks'),
  },
  {
    slug: 'nonogram',
    titleKey: 'game.nonogram',
    loader: () => import('./nonogram'),
  },
  {
    slug: 'sudoku',
    titleKey: 'game.sudoku',
    loader: () => import('./sudoku'),
  },
  {
    slug: 'pipes',
    titleKey: 'game.pipes',
    loader: () => import('./pipes'),
  },
  {
    slug: 'defense',
    titleKey: 'game.defense',
    loader: () => import('./defense'),
  },
  {
    slug: 'jump',
    titleKey: 'game.jump',
    loader: () => import('./jump'),
  },
  {
    slug: 'rhythm',
    titleKey: 'game.rhythm',
    loader: () => import('./rhythm'),
  },
  {
    slug: 'orbit',
    titleKey: 'game.orbit',
    loader: () => import('./orbit'),
  },
  {
    slug: 'wordle',
    titleKey: 'game.wordle',
    loader: () => import('./wordle'),
  },
  {
    slug: 'omok',
    titleKey: 'game.omok',
    loader: () => import('./omok'),
  },
  {
    slug: 'deck',
    titleKey: 'game.deck',
    loader: () => import('./deck'),
  },
  {
    slug: 'autochess',
    titleKey: 'game.autochess',
    loader: () => import('./autochess'),
  },
  {
    slug: 'stack',
    titleKey: 'game.stack',
    loader: () => import('./stack'),
  },
  {
    slug: 'sortgate',
    titleKey: 'game.sortgate',
    loader: () => import('./sortgate'),
  },
  {
    slug: 'numorder',
    titleKey: 'game.numorder',
    loader: () => import('./numorder'),
  },
  {
    slug: 'flashnum',
    titleKey: 'game.flashnum',
    loader: () => import('./flashnum'),
  },
  {
    slug: 'paperboat',
    titleKey: 'game.paperboat',
    loader: () => import('./paperboat'),
  },
  {
    slug: 'samepic',
    titleKey: 'game.samepic',
    loader: () => import('./samepic'),
  },
  {
    slug: 'comet',
    titleKey: 'game.comet',
    loader: () => import('./comet'),
  },
  {
    slug: 'iceslide',
    titleKey: 'game.iceslide',
    loader: () => import('./iceslide'),
  },
  {
    slug: 'marblejar',
    titleKey: 'game.marblejar',
    loader: () => import('./marblejar'),
  },
  {
    slug: 'bamboo',
    titleKey: 'game.bamboo',
    loader: () => import('./bamboo'),
  },
  {
    slug: 'reflect',
    titleKey: 'game.reflect',
    loader: () => import('./reflect'),
    // 점수가 없는 게임 — 기록은 스스로 깬 최고 단계다
    recordUnit: 'stage',
  },
]
