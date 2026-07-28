#!/usr/bin/env python3
"""i18n.ts의 13개 언어 사전에 키를 한꺼번에 넣는다.

문구 하나를 추가하려면 13곳을 고쳐야 하고, 한 곳만 빠뜨리면 그 언어에서만
키가 그대로 노출된다. 손으로 하지 않으려고 만들었다.

    python3 tools/add-i18n.py <기준키> <새키> <en> <ko> <ja> <zh> <es> <pt> <fr> <de> <ru> <id> <vi> <th> <tr>

기준키 바로 아래에 넣는다. 언어 순서는 i18n.ts에 사전이 나오는 순서와 같다.
"""

import re
import sys

PATH = 'src/shared/i18n.ts'
LANGS = 13


def main():
    if len(sys.argv) != 3 + LANGS:
        print(__doc__)
        sys.exit(1)
    anchor, key = sys.argv[1], sys.argv[2]
    values = sys.argv[3:]

    src = open(PATH, encoding='utf-8').read()
    if f"'{key}':" in src:
        print(f'이미 있는 키: {key}')
        sys.exit(1)

    spots = [m for m in re.finditer(rf"^  '{re.escape(anchor)}': .*\n", src, re.M)]
    if len(spots) != LANGS:
        print(f'기준키 {anchor}를 {len(spots)}곳에서 찾았다 (13곳이어야 한다)')
        sys.exit(1)

    # 뒤에서부터 넣어야 앞쪽 위치가 밀리지 않는다
    for i in range(LANGS - 1, -1, -1):
        text = values[i].replace('\\', '\\\\').replace("'", "\\'")
        line = f"  '{key}': '{text}',\n"
        src = src[: spots[i].end()] + line + src[spots[i].end():]

    open(PATH, 'w', encoding='utf-8').write(src)
    print(f'{key} 13개 언어에 추가')


if __name__ == '__main__':
    main()
