import type { GameMeta } from './types'

// 게임 추가 = 여기에 한 줄 등록 (thumbnail은 당분간 이모지, 추후 이미지 URL로 교체 가능)
export const GAMES: GameMeta[] = [
  {
    slug: 'suika',
    title: '수박 합치기',
    thumbnail: '🍉',
    loader: () => import('./suika'),
  },
]
