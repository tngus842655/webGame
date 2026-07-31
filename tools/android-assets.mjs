// 안드로이드 런처 아이콘·스플래시를 웹 아이콘 하나에서 만들어 낸다.
// `npx cap add android`가 찍어주는 기본값은 Capacitor 로고라 그대로 두면 안 된다.
//
//   node tools/android-assets.mjs
//
// 아이콘을 새로 그리면 SOURCE만 바꿔서 다시 돌리면 된다.

import { mkdir, writeFile, rm } from 'node:fs/promises'
import sharp from 'sharp'

const SOURCE = 'public/icon/icon-eng-512-v1.png'
const RES = 'android/app/src/main/res'

// 아이콘 가장자리에서 뽑은 남색. 적응형 아이콘 배경으로 깔면 원/스퀘어 마스크가
// 어디서 잘리든 아트워크와 이음매가 보이지 않는다.
const ICON_BG = '#00092F'
// 매니페스트·index.html의 theme_color와 같은 값
const SPLASH_BG = '#FFF8E1'

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

// 적응형 아이콘은 108dp 캔버스 중 안쪽 72dp만 어떤 마스크에서도 살아남는다.
// 아트워크가 가장자리까지 꽉 찬 그림이라 잘라내는 대신 안전 영역에 맞춰 줄인다.
const SAFE_RATIO = 72 / 108

const circleMask = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  )

async function launcherIcons() {
  for (const [density, scale] of Object.entries(DENSITIES)) {
    const dir = `${RES}/mipmap-${density}`
    await mkdir(dir, { recursive: true })

    const legacy = Math.round(48 * scale)
    // 원본은 모서리가 둥근 투명 PNG다. 배경을 깔아야 런처가 제 색으로 채운다.
    const square = await sharp(SOURCE)
      .resize(legacy, legacy)
      .flatten({ background: ICON_BG })
      .png()
      .toBuffer()
    await writeFile(`${dir}/ic_launcher.png`, square)

    // API 25 이하만 쓰는 원형 아이콘. 26부터는 적응형이 대신한다
    await sharp(square)
      .composite([{ input: circleMask(legacy), blend: 'dest-in' }])
      .png()
      .toFile(`${dir}/ic_launcher_round.png`)

    const canvas = Math.round(108 * scale)
    const art = Math.round(canvas * SAFE_RATIO)
    const pad = Math.round((canvas - art) / 2)
    await sharp(await sharp(SOURCE).resize(art, art).png().toBuffer())
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#00000000' })
      .png()
      .toFile(`${dir}/ic_launcher_foreground.png`)
  }

  await writeFile(
    `${RES}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${ICON_BG}</color>
</resources>
`,
  )
}

async function splash() {
  // 기본 템플릿은 밀도·방향별 splash.png를 깔아두는데, 배경으로 늘려 쓰는 방식이라
  // 화면 비율마다 아이콘이 찌그러진다. 색 위에 아이콘을 얹는 레이어 하나로 바꾼다.
  for (const density of Object.keys(DENSITIES)) {
    await rm(`${RES}/drawable-port-${density}`, { recursive: true, force: true })
    await rm(`${RES}/drawable-land-${density}`, { recursive: true, force: true })
  }
  await rm(`${RES}/drawable/splash.png`, { force: true })

  await sharp(SOURCE).resize(384, 384).png().toFile(`${RES}/drawable/splash_icon.png`)

  await writeFile(
    `${RES}/drawable/splash.xml`,
    `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splashBackground" />
    <item>
        <bitmap android:gravity="center" android:src="@drawable/splash_icon" />
    </item>
</layer-list>
`,
  )
}

await launcherIcons()
await splash()
console.log(`아이콘·스플래시 생성 완료 (${SOURCE} → ${RES})`)
