import type { GameMeta } from './types'

// 게임 추가 = 여기에 한 줄 등록 (thumbnail은 당분간 이모지, 추후 이미지 URL로 교체 가능)
export const GAMES: GameMeta[] = [
  {
    slug: 'suika',
    title: '수박 합치기',
    thumbnail: '🍉',
    loader: () => import('./suika'),
  },
  {
    slug: 'blockblast',
    title: '블록 블라스트',
    thumbnail: '🟦',
    loader: () => import('./blockblast'),
  },
  {
    slug: 'brick',
    title: '벽돌깨기 RPG',
    thumbnail: '🧱',
    loader: () => import('./brick'),
  },
  {
    slug: 'fruit2048',
    title: '과일 2048',
    thumbnail: '🍒',
    loader: () => import('./fruit2048'),
  },
  {
    slug: 'runner',
    title: '무한 러너',
    thumbnail: '🏃',
    loader: () => import('./runner'),
  },
  {
    slug: 'dodge',
    title: '낙하물 회피',
    thumbnail: '🌧️',
    loader: () => import('./dodge'),
  },
  {
    slug: 'golf',
    title: '미니 골프',
    thumbnail: '⛳',
    loader: () => import('./golf'),
  },
  {
    slug: 'survivor',
    title: '서바이버',
    thumbnail: '⚔️',
    loader: () => import('./survivor'),
  },
  {
    slug: 'stock',
    title: '모의 주식 타이쿤',
    thumbnail: '📈',
    loader: () => import('./stock'),
  },
  {
    slug: 'merge',
    title: '머지 가든',
    thumbnail: '🌱',
    loader: () => import('./merge'),
  },
]
