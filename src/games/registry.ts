import type { GameMeta } from './types'

// 게임 추가 = 여기에 한 줄 등록 (thumbnail은 당분간 이모지, 추후 이미지 URL로 교체 가능)
// titleKey는 shared/i18n.ts의 번역 키
export const GAMES: GameMeta[] = [
  {
    slug: 'suika',
    titleKey: 'game.suika',
    thumbnail: '🍉',
    loader: () => import('./suika'),
  },
  {
    slug: 'blockblast',
    titleKey: 'game.blockblast',
    thumbnail: '🟦',
    loader: () => import('./blockblast'),
  },
  {
    slug: 'brick',
    titleKey: 'game.brick',
    thumbnail: '🧱',
    loader: () => import('./brick'),
  },
  {
    slug: 'fruit2048',
    titleKey: 'game.fruit2048',
    thumbnail: '🍒',
    loader: () => import('./fruit2048'),
  },
  {
    slug: 'runner',
    titleKey: 'game.runner',
    thumbnail: '🏃',
    loader: () => import('./runner'),
  },
  {
    slug: 'dodge',
    titleKey: 'game.dodge',
    thumbnail: '🌧️',
    loader: () => import('./dodge'),
  },
  {
    slug: 'golf',
    titleKey: 'game.golf',
    thumbnail: '⛳',
    loader: () => import('./golf'),
  },
  {
    slug: 'survivor',
    titleKey: 'game.survivor',
    thumbnail: '⚔️',
    loader: () => import('./survivor'),
  },
  {
    slug: 'stock',
    titleKey: 'game.stock',
    thumbnail: '📈',
    loader: () => import('./stock'),
  },
  {
    slug: 'merge',
    titleKey: 'game.merge',
    thumbnail: '🌱',
    loader: () => import('./merge'),
  },
]
