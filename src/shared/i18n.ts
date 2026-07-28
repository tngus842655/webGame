import { ref } from 'vue'

// 경량 i18n — 허브(Vue)와 게임(Canvas) 양쪽에서 t()를 쓴다.
// 게임은 매 프레임 다시 그리므로 언어 변경이 즉시 반영된다.
// 번역 범위: 사용자에게 보이는 것은 13개 언어 전부 채운다 (허브·게임 내부·가이드·광고).
// 예외는 둘뿐 — 관리자/통계/개발노트 화면은 운영자만 보므로 ko/en만,
// 개인정보처리방침은 법적 문서라 한국어만 (PrivacyPage.vue 주석 참고).

export type Locale =
  | 'ko'
  | 'en'
  | 'ja'
  | 'zh-CN'
  | 'es'
  | 'pt-BR'
  | 'fr'
  | 'de'
  | 'ru'
  | 'id'
  | 'vi'
  | 'th'
  | 'tr'

// 설정 화면 선택지 (라벨은 해당 언어 원어 표기라 번역 불필요)
export const LOCALES: Array<{ code: Locale; label: string }> = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'es', label: 'Español' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ไทย' },
  { code: 'tr', label: 'Türkçe' },
]

const STORAGE_KEY = 'webgame:locale'

const en = {
  'app.title': 'MiniGame30',
  'onboard.langTitle': 'Choose your language',
  'onboard.next': 'Next',
  'onboard.accountTitle': 'Played here before?',
  'onboard.accountBody': 'If you linked a Google or Kakao account before, you can bring those records over.',
  'onboard.accountNo': 'No, I\'m new here',
  'onboard.back': 'Back',
  'onboard.nickTitle': 'What should we call you?',
  'onboard.start': 'Start',
  'onboard.saving': 'Getting ready…',
  'onboard.failed': 'Couldn\'t get started. Please try again in a moment.',
  'home.best': 'Best {n}',
  'home.myRank': '{score} pts (#{rank})',
  'home.ranking': 'Rankings',
  'common.back': 'Home',
  'common.tapClose': 'Tap anywhere to close',
  'home.sectionNew': 'New',
  'home.sectionPopular': 'Popular',
  'home.sectionMore': 'More games',
  'trash.title': 'Trash',
  'trash.hint': 'Games that moved out of the main list. You can still play them here.',
  'trash.empty': 'Nothing here yet.',
  'stats.title': 'Statistics',
  'notes.title': 'Dev notes',
  'notes.empty': 'Nothing here yet. Updates will show up as they land.',
  // 운영자 전용 화면 — 다른 언어는 en 폴백으로 둔다
  'admin.title': 'Admin',
  'admin.hint':
    'Games checked as New go on the New shelf at the top of the home screen (up to 3). Order follows the sequence you checked them in; unchecking one pulls the rest up. The rest stay in popularity order: the top 3 fill the Popular shelf and everything below goes on the last one. An orange rank on the right means the game dropped out of the top 30. Changes show up the next time the home screen opens.',
  'admin.featured': 'New',
  'admin.hidden': 'Hide',
  'admin.order': 'Order',
  'admin.saveFailed': 'Could not save.',
  'admin.featuredMax': 'The New shelf holds {n} games. Uncheck one first.',
  'admin.rank': '#{n}',
  'admin.unranked': 'no plays yet',
  'admin.trash': 'Trash',
  'admin.toTrash': 'Trash',
  'admin.trashConfirm': 'Move "{name}" to the trash? It disappears from the game list right away.',
  'admin.trashHint':
    'These games left the main list and moved to the trash at the bottom of the home screen. Players can still play them there; turning on Hide removes them from that trash too. After {days} days they are ready to be removed from the code — that part is a commit, not a button.',
  'admin.trashEmpty': 'The trash is empty.',
  'admin.trashedOn': 'Trashed {date}',
  'admin.daysLeft': '{n} days left',
  'admin.removable': 'ready to remove',
  'admin.removableNotice': '{n} game(s) have finished their hold — safe to delete from the code.',
  'admin.restore': 'Restore',
  'stats.days': 'last {n}d',
  'stats.hint':
    'Periods are rolling windows counted back from right now, not calendar days. A segment is one uninterrupted stretch of play — sending the app to the background ends one and starts another, so segments are not rounds.',
  'stats.plays': 'Segments',
  'stats.playtime': 'Play time',
  'stats.players': 'Players',
  'stats.avg': 'Avg segment',
  'stats.best': 'Top score',
  'stats.hour': 'h',
  'stats.minute': 'm',
  'stats.second': 's',
  'ranking.title': '{name} Rankings',
  'ranking.week': 'Weekly',
  'ranking.all': 'All-time',
  'ranking.loading': 'Loading…',
  'ranking.error': "Couldn't load rankings. Please try again later.",
  'ranking.empty': 'No records yet. Be the first!',
  'ranking.unknown': 'Unknown game',
  'settings.title': 'Settings',
  'settings.nickname': 'Nickname',
  'settings.nicknameHint': 'Shown on the rankings.',
  'settings.placeholder': '2–12 chars',
  'settings.save': 'Save',
  'settings.saving': 'Saving…',
  'settings.saved': 'Saved! Applied to rankings right away.',
  'settings.saveFailed': 'Save failed. Please try again later.',
  'settings.loadFailed': "Couldn't load your profile. Check your connection.",
  'settings.lengthError': 'Nickname must be 2–12 characters.',
  'settings.sound': 'Sound',
  'settings.soundOn': 'Sound effects',
  'settings.musicOn': 'Background music',
  'settings.language': 'Language',
  'privacy.title': 'Privacy Policy',
  'account.title': 'Account',
  'account.hint': 'You can keep playing without linking. But records stay on this device only.',
  'account.linked': 'Linked with {provider}.',
  'account.switch': 'Switch to another account',
  'account.switchHint': 'Your current account stays as it is — sign in again any time to come back.',
  'account.cancel': 'Cancel',
  'account.linking': 'Opening…',
  'account.exists': 'This {provider} account is already in use. Load its records instead?',
  'account.existsWarn': 'The records on this device will no longer be reachable.',
  'account.restore': 'Load those records',
  'account.failed': 'Couldn\'t link. Please try again in a moment.',
  'account.nicknameApplied': 'Your nickname is now {name}. This is the name shown on the rankings — change it below if you like.',
  'account.maybeExists': 'Already played with this account before?',
  'account.google': 'Google',
  'account.kakao': 'Kakao',
  'guide.title': 'How to play',
  'pause.title': 'Paused',
  'pause.resume': 'Resume',
  'pause.quit': 'Quit',
  'guide.goal': 'Goal',
  'guide.how': 'Controls',
  'guide.score': 'Scoring',
  'guide.close': 'Got it',
  'over.title': 'Game Over',
  'over.bestScore': 'Best {n}',
  'over.newRecord': 'New record!',
  'over.retry': 'Retry',
  'over.byTime': 'Time\'s up',
  'over.byLives': 'Out of lives',
  'over.byHp': 'You were defeated',
  'over.byMoves': 'Out of moves',
  'over.byStuck': 'No moves left to make',
  'over.byClear': 'You made it to the end',
  'hud.best': 'Best {n}',
  'hud.record': 'Record {n}',
  'ad.sim': 'Ad (dev simulation)',
  'ad.skip': 'Skip (no reward)',
  'ad.claim': 'Claim reward',
  'ad.done': 'Done!',
  'bonus.title': 'Cleared!',
  'bonus.gain': '+{n}',
  'bonus.double': '▶ Watch ad to double it',
  'bonus.keep': 'Just take it',
  'game.suika': 'Melon Merge',
  'game.blockblast': 'Block Blast',
  'game.brick': 'Brick Breaker',
  'game.fruit2048': 'Fruit 2048',
  'game.runner': 'Endless Runner',
  'game.dodge': 'Falling Dodge',
  'game.survivor': 'Survivor',
  'game.merge': 'Merge Garden',
  'hud.score': 'Score',
  'suika.ad': '▶ Watch ad to continue (clear small fruit)',
  'bb.ad': '▶ Watch ad to swap blocks',
  'brick.wave': 'Wave {n}',
  'brick.attack': 'Damage',
  'brick.balls': 'Balls',
  'brick.ad': '▶ Watch ad to continue (clear 3 rows)',
  'f2.ad': '▶ Watch ad to undo last move',
  'run.ad': '▶ Watch ad to continue',
  'dodge.ad': '▶ Watch ad to continue',
  'sv.time': '{n}s',
  'sv.kills': 'Kills {k} · Lv.{lv}',
  'sv.levelup': 'Level up! Choose an upgrade',
  'sv.taken': 'So far',
  'sv.dmg': 'Damage +1',
  'sv.dmgDesc': 'Bullets hit harder',
  'sv.rate': 'Fire rate +20%',
  'sv.rateDesc': 'Shoot faster',
  'sv.spd': 'Move speed +12%',
  'sv.spdDesc': 'Move faster',
  'sv.hp': 'Max HP +1',
  'sv.hpDesc': 'Also heals 1 HP',
  'sv.ad': '▶ Watch ad to revive',
  'merge.gen': 'Spawn',
  'merge.full': 'No room · merge to free space',
  'merge.stageLabel': 'Stage',
  'merge.cleared': '🏆 All 10 stages cleared!',
  'merge.clear': 'Stage {n} clear!',
  'merge.nextStage': 'Next: stage {n} · {g} golden pots',
  'merge.ad': '▶ Watch ad for +60s (and clear low items)',
  'game.match3': 'Jewel Match',
  'game.tripeaks': 'TriPeaks Solitaire',
  'game.nonogram': 'Nonogram',
  'm3.level': 'Level {n}',
  'm3.goal': 'Goal {n}',
  'm3.moves': 'Moves {n}',
  'm3.ad': '▶ Watch ad for +5 moves',
  'tp.stage': 'Stage {n}',
  'tp.streak': 'Streak x{n}',
  'tp.ad': '▶ Watch ad for +3 cards',
  'no.puzzle': 'Puzzle {n}',
  'no.fill': 'Fill',
  'no.mark': 'Mark',
  'no.ad': '▶ Watch ad to continue (+1 life)',
  'game.sudoku': 'Sudoku Daily',
  'sd.daily': 'Daily {date}',
  'sd.practice': 'Practice {n}',
  'sd.memo': 'Memo',
  'sd.streak': '🔥 Streak {n}',
  'sd.ad': '▶ Watch ad to continue (+1 life)',
  'game.pipes': 'Pipe Connect',
  'pp.level': 'Level {n}',
  'pp.ad': '▶ Watch ad for +30s',
  'game.defense': 'Tower Defense',
  'df.wave': 'Wave {n}',
  'df.summon': 'Summon {n}G',
  'df.ad': '▶ Watch ad to revive (5 lives)',
  'game.jump': 'Jump Challenge',
  'jc.ad': '▶ Watch ad for +60s',
  'game.rhythm': 'Rhythm Tap',
  'rt.ad': '▶ Watch ad to continue (restore health)',
  'rt.speed': 'Speed',
  'game.orbit': 'Orbit Shooter',
  'ob.ad': '▶ Watch ad to revive (+2 lives)',
  'game.wordle': 'Hangul Wordle',
  'wd.enter': 'Enter',
  'wd.share': 'Share',
  'wd.copied': 'Copied!',
  'wd.answer': 'Answer: {word}',
  'wd.ad': '▶ Watch ad for one more row',
  'game.omok': 'Gomoku',
  'om.win': 'Stage {n} cleared!',
  'om.lose': 'You lost…',
  'om.stage': 'Stage {n} / {m}',
  'om.resumeTitle': 'Continue where you left off?',
  'om.resume': 'Resume from stage {n}',
  'om.fresh': 'Start from stage 1',
  'om.cleared': '🏆 All 10 stages cleared!',
  'om.timeBonus': 'Time bonus +{n}',
  'om.timeout': 'Out of time…',
  'om.you': 'Your turn (black)',
  'om.think': 'AI is thinking…',
  'om.undo': '▶ Watch ad to undo a move',
  'om.ad': '▶ Watch ad to retry this stage',
  'game.deck': 'Card Battler',
  'dk.stage': 'Stage {n}',
  'dk.deck': 'My deck ({n})',
  'dk.endTurn': 'End turn',
  'dk.pick': 'Pick a card for your deck',
  'dk.skip': 'Skip',
  'dk.ad': '▶ Watch ad to revive (30 HP)',
  'dk.strike': 'Strike',
  'dk.defend': 'Defend',
  'dk.bash': 'Bash',
  'dk.flurry': 'Flurry',
  'dk.wall': 'Great Wall',
  'dk.drain': 'Drain',
  'dk.focus': 'Focus',
  'dk.nova': 'Nova',
  'game.autochess': 'Auto Battler',
  'ac.round': 'Round {n}',
  'ac.fight': 'Start battle',
  'ac.shop': 'Shop (tap to buy)',
  'ac.foes': 'This round\'s opponents',
  'ac.win': 'Victory! +{n}',
  'ac.lose': 'Defeat… -{n}',
  'ac.ad': '▶ Watch ad to revive (5 HP)',
  'ac.s1': 'Warrior',
  'ac.s2': 'Archer',
  'ac.s3': 'Guard',
  'ac.s4': 'Mage',
  'game.stack': 'Tower Stack',
  'st.floor': 'Floor {n}',
  'st.perfect': 'Perfect!',
  'st.ad': '▶ Watch ad to get half the width back',
  'game.sortgate': 'Sorting Duty',
  'sg.ad': '▶ Watch ad for one more life',
  'game.numorder': 'Number Line-up',
  'nm.round': 'Board {n}',
  'nm.clear': 'Board complete! +{n}',
  'nm.ad': '▶ Watch ad to empty the blocking slot',
  'game.flashnum': 'Flash Numbers',
  'fn.level': 'Level {n}',
  'fn.memorize': 'Memorize them!',
  'fn.order': 'Tap from the smallest number',
  'fn.ad': '▶ Watch ad to retry this level',
  'game.paperboat': 'Paper Boat Lanes',
  'pb.ad': '▶ Watch ad to clear just those two boats',
  'game.samepic': 'Spot the Match',
  'sp.ad': '▶ Watch ad for +10s (keep half the combo)',
  'game.comet': 'Comet Chain',
  'cm.chain': 'Best chain {n}',
  'cm.ad': '▶ Watch ad to reset your misses',
  'game.iceslide': 'Penguin Slide',
  'ic.level': 'Board {n}',
  'ic.moves': 'Moves {n}',
  'ic.undo': 'Undo ({n})',
  'ic.restart': 'Restart board',
  'ic.undoAd': '▶ Watch ad to undo',
  'ic.clear': 'Board clear! +{n}',
  'ic.ad': '▶ Watch ad for 5 more moves',
  'game.marblejar': 'Marble Jars',
  'mj.hint': 'Pick a jar for this marble',
  'mj.colors': '{n} colours in play',
  'mj.ad': '▶ Watch ad to empty one jar',
  'game.bamboo': 'Bamboo Climb',
  'bm.height': '{n} joints up',
  'bm.ad': '▶ Watch ad to refill time and continue',
}

export type TranslationKey = keyof typeof en
// 한국어는 빠짐없이 채운다 (빠진 키가 있으면 타입에서 걸린다)
export type FullDict = Record<TranslationKey, string>
// 나머지 언어: 허브·게임오버·광고·제목까지 번역, 게임 내부 텍스트는 en 폴백
export type CoreDict = Partial<FullDict>

// 사전 12벌을 다 싣고 시작하면 첫 화면이 40KB(gzip)를 남의 언어에 쓴다.
// 고른 언어 하나만 받아 온다 — en은 폴백이라 늘 들어 있다.
const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: CoreDict }>> = {
  ko: () => import('./locales/ko'),
  ja: () => import('./locales/ja'),
  'zh-CN': () => import('./locales/zhCN'),
  es: () => import('./locales/es'),
  'pt-BR': () => import('./locales/ptBR'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  ru: () => import('./locales/ru'),
  id: () => import('./locales/id'),
  vi: () => import('./locales/vi'),
  th: () => import('./locales/th'),
  tr: () => import('./locales/tr'),
}

// ref로 두어야 사전이 도착한 순간 Vue 화면이 다시 그려진다
const loaded = ref<Partial<Record<Locale, CoreDict>>>({ en })

function detectLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && (saved === 'en' || saved in LOADERS)) return saved as Locale
  for (const lang of navigator.languages ?? [navigator.language]) {
    const lower = lang.toLowerCase()
    if (lower.startsWith('zh')) return 'zh-CN'
    if (lower.startsWith('pt')) return 'pt-BR'
    const short = lower.split('-')[0]
    if (short in LOADERS) return short as Locale
  }
  return 'en'
}

export const locale = ref<Locale>(detectLocale())

// 사전을 받아 온다. 이미 있거나 실패하면 en 폴백으로 그냥 논다.
export async function loadLocale(next: Locale): Promise<void> {
  if (next === 'en' || loaded.value[next]) return
  const mod = await LOADERS[next]().catch(() => null)
  if (mod) loaded.value = { ...loaded.value, [next]: mod.default }
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text = loaded.value[locale.value]?.[key] ?? en[key] ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value))
    }
  }
  return text
}

function applyToDocument() {
  document.documentElement.lang = locale.value
  document.title = t('app.title')
}

export function setLocale(next: Locale) {
  locale.value = next
  localStorage.setItem(STORAGE_KEY, next)
  void loadLocale(next).then(applyToDocument)
  applyToDocument()
}

applyToDocument()
