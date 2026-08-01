package com.minigame30.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // 폰 설정의 '글자 크기'는 웹뷰에서 글자만 키운다. 카드 폭과 여백은 px로 고정이라
    // 상자는 그대로인 채 안의 글자만 자라고, 최대치에서는 기록 문구가 잘리고
    // 캐러셀 가운데 정렬까지 틀어졌다.
    //
    // 그렇다고 100%로 고정해 설정을 통째로 무시하지는 않는다. 여기까지는 화면이
    // 버티는 선이라 그 위만 깎는다.
    //
    // '화면 크게/작게'는 그대로 따라간다 — 그쪽은 밀도를 바꿔서 글자와 카드가
    // 비율을 지킨 채 같이 커지므로 손댈 이유가 없다.
    private static final float MAX_FONT_SCALE = 1.15f;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 기기에 웹뷰가 없으면 BridgeActivity가 안내 화면만 띄우고 bridge를 만들지 않는다
        if (bridge == null) return;
        float scale = Math.min(getResources().getConfiguration().fontScale, MAX_FONT_SCALE);
        bridge.getWebView().getSettings().setTextZoom(Math.round(scale * 100));
    }
}
