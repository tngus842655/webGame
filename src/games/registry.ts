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
    slug: 'golf',
    titleKey: 'game.golf',
    loader: () => import('./golf'),
  },
  {
    slug: 'survivor',
    titleKey: 'game.survivor',
    loader: () => import('./survivor'),
  },
  {
    slug: 'stock',
    titleKey: 'game.stock',
    loader: () => import('./stock'),
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
    slug: 'mahjong',
    titleKey: 'game.mahjong',
    loader: () => import('./mahjong'),
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
    slug: 'estate',
    titleKey: 'game.estate',
    loader: () => import('./estate'),
  },
  {
    slug: 'store',
    titleKey: 'game.store',
    loader: () => import('./store'),
  },
  {
    slug: 'tuber',
    titleKey: 'game.tuber',
    loader: () => import('./tuber'),
  },
  {
    slug: 'reigns',
    titleKey: 'game.reigns',
    loader: () => import('./reigns'),
  },
  {
    slug: 'focus',
    titleKey: 'game.focus',
    loader: () => import('./focus'),
  },
]
