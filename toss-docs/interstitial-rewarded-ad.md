> For the complete documentation index, see [llms.txt](https://developers-apps-in-toss.toss.im/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa/interstitial-rewarded-ad.md).

# 인앱 광고 - 전면형/보상형 광고

서비스 소개와 콘솔 설정 방법은 인앱 광고 소개 문서를 참고해 주세요.

인앱 광고 2.0 ver2는 **토스 애즈(Toss Ads)** 와 **구글 애드몹(Google AdMob)** 을 통합해 환경에 따라 **가장 적합한 광고를 자동으로 선택·노출하는 통합 광고 솔루션**이에요. 파트너사는 하나의 SDK만 연동하면 되고, 어떤 네트워크를 사용할지는 환경에 맞춰 SDK가 자동으로 선택해요. 광고 노출 성공률을 높여 보다 안정적인 수익을 기대할 수 있어요.

**전면형(Interstitial)** 과 **보상형(Rewarded)** 광고 모두 동일 API(`loadFullScreenAd`, `showFullScreenAd`)를 사용하며, 광고 타입은 **광고 그룹 ID(`adGroupId`)** 를 기준으로 자동 결정돼요.

### 지원 버전

통합 광고 API는 토스 앱 버전에 따라 다르게 동작해요 :

| 토스 앱 버전                   | 지원 기능          | 설명                   |
| ------------------------- | -------------- | -------------------- |
| **5.247.0 이상**            | 인앱 광고 2.0 ver2 | 토스 애즈 + AdMob        |
| **5.227.0 \~ 5.247.0 미만** | 인앱 광고 2.0      | AdMob 단독 지원          |
| **5.227.0 미만**            | 미지원            | 인앱 광고 2.0 ver2 사용 불가 |

> `isSupported()` 메서드로 현재 환경에서 인앱 광고 2.0 ver2를 사용할 수 있는지 확인할 수 있어요.

***

### API 개요

* `loadFullScreenAd(params: LoadFullScreenAdParams): () => void` — 광고를 미리 로드해요. 반환값으로 콜백 등록 해제 함수(noop 형태)를 제공해요.
* `showFullScreenAd(params: ShowFullScreenAdParams): () => void` — 로드된 광고를 화면에 표시해요. 마찬가지로 해제 함수를 반환해요.

각 API는 `isSupported()` 프로퍼티를 통해 현재 환경에서 해당 기능 사용 가능 여부를 확인할 수 있어요.

***

### 광고 불러오기

**SDK 함수:** `loadFullScreenAd`

```typescript
function loadFullScreenAd(params: LoadFullScreenAdParams): () => void;
```

광고를 미리 로드해요. 광고를 표시하기 전에 반드시 호출해야 해요.

{% hint style="info" %}
**안정적으로 운영하려면 이렇게 구현해 주세요**

* 페이지(또는 화면) 단위로 광고를 미리 로드해 주세요.
* 광고는 반드시 **`load → show → (다음 load)`** 순서로 호출해 주세요.
* `loadFullScreenAd` 호출 후 **이벤트를 받은 뒤** `showFullScreenAd`를 호출해야 해요.
* 같은 `adGroupId` 기준으로는 한 번에 하나의 광고만 미리 로드할 수 있어요.
* 여러 `adGroupId`를 사용할 때는 각 `adGroupId`별로 하나씩 미리 로드해 둘 수 있어요.
* 광고를 표시한 뒤에는 다음 광고를 미리 로드해 두는 패턴(`load → show → load → show`)을 권장해요.
  {% endhint %}

{% hint style="info" %}
**iOS에서 로드되지 않나요?**

iOS에서 광고가 로드되지 않는 경우 **앱 추적 모드(App Tracking Transparency)** 설정을 확인해 주세요. 앱 추적이 허용되지 않은 상태에서는 일부 광고 로드가 정상 동작하지 않을 수 있어요.
{% endhint %}

**파라미터**

* **params** · 필수 · `LoadFullScreenAdParams`

  광고를 미리 로드할 때 사용하는 설정 객체예요. 광고 그룹 ID와 광고 로드 이벤트/오류 콜백을 설정할 수 있어요.

  * **params.options** · 필수 · `LoadFullScreenAdOptions`

    광고를 불러올 때 전달하는 옵션 객체예요.

    * **params.options.adGroupId** · 필수 · `string`

      광고 그룹 ID예요. 콘솔에서 발급받은 ID를 입력해야 해요.
  * **params.onEvent** · `(event: LoadFullScreenAdEvent) => void`

    광고 로드 중 발생하는 이벤트를 전달받는 콜백이에요. 광고 로드 성공 이벤트 등 다양한 이벤트를 받을 수 있어요.
  * **params.onError** · `(error: unknown) => void`

    광고를 불러오는 데 실패했을 때 호출돼요. 네트워크 오류 또는 지원하지 않는 환경 등이 원인이 될 수 있어요.

**프로퍼티**

**`isSupported`**

```typescript
loadFullScreenAd.isSupported(): boolean
```

현재 환경에서 인앱 광고 2.0 ver2 광고를 사용할 수 있는지 확인해요.

**예제**

{% tabs %}
{% tab title="tsx\[React]" %}

```tsx
import { loadFullScreenAd } from '@apps-in-toss/web-framework';
import { useState, useEffect } from 'react';

function AdComponent() {
  const [isAdLoaded, setIsAdLoaded] = useState(false);

  useEffect(() => {
    // 지원 여부 확인
    if (!loadFullScreenAd.isSupported()) {
      console.warn('광고 기능을 사용할 수 없습니다.');
      return;
    }

    // 광고 로드
    const unregister = loadFullScreenAd({
      options: {
        adGroupId: 'ait.dev.43daa14da3ae487b',
      },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          console.log('광고 로드 완료');
          setIsAdLoaded(true);
        }
      },
      onError: (error) => {
        console.error('광고 로드 실패:', error);
      },
    });

    // 클린업
    return () => unregister();
  }, []);

  return (
    <button disabled={!isAdLoaded}>
      {isAdLoaded ? '광고 보기' : '광고 로딩 중...'}
    </button>
  );
}
```

{% endtab %}

{% tab title="React Native" %}

```tsx
import { loadFullScreenAd } from '@apps-in-toss/framework';
import { useEffect, useState } from 'react';
import { Alert, Button, View } from 'react-native';

function AdComponent() {
  const [isAdLoaded, setIsAdLoaded] = useState(false);

  useEffect(() => {
    // 지원 여부 확인
    if (!loadFullScreenAd.isSupported()) {
      Alert.alert('광고 기능을 사용할 수 없습니다.');
      return;
    }

    // 광고 로드
    const unregister = loadFullScreenAd({
      options: {
        adGroupId: 'ait.dev.43daa14da3ae487b',
      },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          Alert.alert('광고 로드 완료');
          setIsAdLoaded(true);
        }
      },
      onError: (error) => {
        Alert.alert('광고 로드 실패', String(error));
      },
    });

    // 클린업
    return () => unregister();
  }, []);

  return (
    <View>
      <Button
        title={isAdLoaded ? '광고 보기' : '광고 로딩 중...'}
        disabled={!isAdLoaded}
      />
    </View>
  );
}
```

{% endtab %}
{% endtabs %}

**`LoadFullScreenAdParams`**

```typescript
interface LoadFullScreenAdParams {
  options: LoadFullScreenAdOptions;
  onEvent: (data: LoadFullScreenAdEvent) => void;
  onError: (err: unknown) => void;
}
```

`loadFullScreenAd`의 파라미터 타입이에요.

**`LoadFullScreenAdOptions`**

```typescript
interface LoadFullScreenAdOptions {
  adGroupId: string;
}
```

광고 로드 옵션이에요.

**`LoadFullScreenAdEvent`**

```typescript
interface LoadFullScreenAdEvent {
  type: 'loaded';
}
```

광고 로드 이벤트예요. 광고가 성공적으로 로드되면 `loaded` 타입 이벤트가 발생해요.

***

### 광고 보여주기

**SDK 함수:** `showFullScreenAd`

```typescript
function showFullScreenAd(params: ShowFullScreenAdParams): () => void;
```

로드된 광고를 화면에 표시해요. `loadFullScreenAd`로 미리 로드한 광고를 사용해주세요.

**파라미터**

* **params.options** · 필수 · `ShowFullScreenAdOptions`

  광고를 표시할 때 전달하는 옵션이에요.

  * **params.options.adGroupId** · 필수 · `string`

    광고 그룹 ID예요. 반드시 \`loadFullScreenAd\`에서 사용한 ID와 동일해야 해요.
* **params.onEvent** · 필수 · `(event: ShowFullScreenAdEvent) => void`

  광고 표시 과정에서 발생하는 이벤트를 전달받는 콜백이에요. 광고 노출, 클릭, 보상 지급 등 다양한 이벤트를 받을 수 있어요.
* **params.onError** · 필수 · `(error: unknown) => void`

  광고 표시 요청이 실패했을 때 호출되는 콜백이에요.

**프로퍼티**

**`isSupported`**

```typescript
showFullScreenAd.isSupported(): boolean
```

현재 환경에서 통합 광고를 사용할 수 있는지 확인해요.

**예제**

{% tabs %}
{% tab title="tsx\[React]" %}

```tsx
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import { useState, useEffect } from 'react';

function AdComponent() {
  const AD_GROUP_ID = 'ait.dev.43daa14da3ae487b';
  const [isAdLoaded, setIsAdLoaded] = useState(false);

  useEffect(() => {
    // 컴포넌트 마운트 시 광고 로드
    const unregister = loadFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          setIsAdLoaded(true);
        }
      },
      onError: (error) => {
        console.error('광고 로드 실패:', error);
      },
    });

    return () => unregister();
  }, []);

  const handleShowAd = () => {
    showFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (event) => {
        switch (event.type) {
          case 'requested':
            console.log('광고 표시 요청됨');
            break;
          case 'show':
            console.log('광고 화면 표시됨');
            break;
          case 'impression':
            console.log('광고 노출 기록됨 (수익 발생)');
            break;
          case 'clicked':
            console.log('광고 클릭됨');
            break;
          case 'dismissed':
            console.log('광고가 닫힘');
            setIsAdLoaded(false);
            // 다음 광고 로드
            loadNextAd();
            break;
          case 'failedToShow':
            console.error('광고 표시 실패');
            break;
          case 'userEarnedReward':
            console.log('리워드 획득:', event.data);
            // 사용자에게 리워드 지급
            grantReward(event.data.unitType, event.data.unitAmount);
            break;
        }
      },
      onError: (error) => {
        console.error('광고 표시 실패:', error);
      },
    });
  };

  const loadNextAd = () => {
    loadFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'loaded') setIsAdLoaded(true);
      },
      onError: console.error,
    });
  };

  const grantReward = (unitType: string, unitAmount: number) => {
    // 리워드 지급 로직
    console.log(`${unitType} ${unitAmount}개 지급`);
  };

  return (
    <button onClick={handleShowAd} disabled={!isAdLoaded}>
      광고 보기
    </button>
  );
}
```

{% endtab %}

{% tab title="React Native" %}

```tsx
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/framework';
import { useEffect, useState } from 'react';
import { Alert, Button, View } from 'react-native';

function AdComponent() {
  const AD_GROUP_ID = 'ait.dev.43daa14da3ae487b';
  const [isAdLoaded, setIsAdLoaded] = useState(false);

  useEffect(() => {
    // 컴포넌트 마운트 시 광고 로드
    const unregister = loadFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          setIsAdLoaded(true);
        }
      },
      onError: (error) => {
        Alert.alert('광고 로드 실패', String(error));
      },
    });

    return () => unregister();
  }, []);

  const handleShowAd = () => {
    showFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (event) => {
        switch (event.type) {
          case 'requested':
            console.log('광고 표시 요청됨');
            break;
          case 'show':
            console.log('광고 화면 표시됨');
            break;
          case 'impression':
            console.log('광고 노출 기록됨 (수익 발생)');
            break;
          case 'clicked':
            console.log('광고 클릭됨');
            break;
          case 'dismissed':
            setIsAdLoaded(false);
            loadNextAd();
            break;
          case 'failedToShow':
            Alert.alert('광고 표시 실패');
            break;
          case 'userEarnedReward':
            console.log('리워드 획득:', event.data);
            grantReward(event.data.unitType, event.data.unitAmount);
            break;
        }
      },
      onError: (error) => {
        Alert.alert('광고 표시 실패', String(error));
      },
    });
  };

  const loadNextAd = () => {
    loadFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'loaded') setIsAdLoaded(true);
      },
      onError: (error) => Alert.alert('오류', String(error)),
    });
  };

  const grantReward = (unitType: string, unitAmount: number) => {
    Alert.alert('리워드 획득', `${unitType} ${unitAmount}개가 지급되었습니다.`);
  };

  return (
    <View>
      <Button title="광고 보기" onPress={handleShowAd} disabled={!isAdLoaded} />
    </View>
  );
}
```

{% endtab %}
{% endtabs %}

**`ShowFullScreenAdParams`**

```typescript
interface ShowFullScreenAdParams {
  options: ShowFullScreenAdOptions;
  onEvent: (data: ShowFullScreenAdEvent) => void;
  onError: (err: unknown) => void;
}
```

`showFullScreenAd`의 파라미터 타입이에요.

**`ShowFullScreenAdOptions`**

```typescript
interface ShowFullScreenAdOptions {
  adGroupId: string;
}
```

광고 보여주기 옵션이에요.

**`ShowFullScreenAdEvent`**

```typescript
type ShowFullScreenAdEvent =
  | { type: 'requested' }
  | { type: 'show' }
  | { type: 'impression' }
  | { type: 'clicked' }
  | { type: 'dismissed' }
  | { type: 'failedToShow' }
  | { type: 'userEarnedReward'; data: { unitType: string; unitAmount: number } };
```

광고 보여주기 이벤트예요.

**이벤트 설명**

| 이벤트 타입             | 설명                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `requested`        | 광고 표시 요청이 성공했어요.                                                                              |
| `show`             | 광고가 화면에 표시되었어요.                                                                               |
| `impression`       | 광고 노출이 기록되었어요. (수익 발생 시점)                                                                     |
| `clicked`          | 사용자가 광고를 클릭했어요.                                                                               |
| `dismissed`        | 사용자가 광고를 닫았어요.                                                                                |
| `failedToShow`     | 광고 표시에 실패했어요.                                                                                 |
| `userEarnedReward` | 리워드 광고에서 사용자가 보상을 획득했어요.• `data.unitType`: 리워드 타입 (예: coin, point)• `data.unitAmount`: 리워드 수량 |

***

### 사용 가이드

**광고 로드 타이밍**

광고는 표시하기 전에 미리 로드하는 것을 권장합니다.

* 로드 타이밍 권장 목록
  * 컴포넌트 마운트 시
  * 이전 광고가 닫힌 직후
  * 광고를 표시할 화면으로 전환되기 전

```tsx
// ✅ 좋은 예: 화면 진입 시 미리 로드
useEffect(() => {
  loadFullScreenAd({
    /* ... */
  });
}, []);

// ❌ 나쁜 예: 버튼 클릭 시 로드 (사용자 대기 시간 발생)
const handleClick = () => {
  loadFullScreenAd({
    /* ... */
  }); // 로딩 시간 발생
  showFullScreenAd({
    /* ... */
  });
};
```

**리워드 광고 처리**

`userEarnedReward` 이벤트가 발생했을 때만 리워드를 지급하세요. `dismissed`만으로는 지급하면 안돼요.

```tsx
showFullScreenAd({
  options: { adGroupId: REWARDED_AD_ID },
  onEvent: (event) => {
    if (event.type === 'userEarnedReward') {
      // ✅ 리워드 지급
      grantReward(event.data);
    }

    if (event.type === 'dismissed') {
      // ❌ dismissed만으로는 리워드 지급하지 않음
    }
  },
  onError: console.error,
});
```

**메모리 관리**

컴포넌트 언마운트 시 콜백 등록을 해제하여 메모리 누수를 방지하세요.

```tsx
useEffect(() => {
  const unregister = loadFullScreenAd({
    /* ... */
  });

  return () => {
    unregister(); // 클린업
  };
}, []);
```

**에러 처리**

항상 `onError` 콜백을 제공하여 광고 로드/표시 실패에 대비하세요.

```tsx
loadFullScreenAd({
  options: { adGroupId: AD_GROUP_ID },
  onEvent: (event) => {
    /* ... */
  },
  onError: (error) => {
    console.error('광고 로드 실패:', error);
    // 사용자에게 적절한 피드백 제공 또는 재시도
  },
});
```

***

### 이벤트 플로우

{% tabs %}
{% tab title="전면 광고 (Interstitial)" %}

```
loadFullScreenAd 호출
  ↓
loaded 이벤트 발생
  ↓
showFullScreenAd 호출
  ↓
requested 이벤트 발생
  ↓
show 이벤트 발생 (광고 화면 표시)
  ↓
impression 이벤트 발생 (수익 발생)
  ↓
clicked 이벤트 (클릭 시) 또는 dismissed 이벤트 (닫기 시)
```

{% endtab %}

{% tab title="리워드 광고 (Rewarded)" %}

```
loadFullScreenAd 호출
  ↓
loaded 이벤트 발생
  ↓
showFullScreenAd 호출
  ↓
requested 이벤트 발생
  ↓
show 이벤트 발생 (광고 화면 표시)
  ↓
impression 이벤트 발생 (수익 발생)
  ↓
[사용자가 광고 시청 완료]
  ↓
userEarnedReward 이벤트 발생 (리워드 지급)
  ↓
dismissed 이벤트 발생 (광고 닫기)
```

{% endtab %}
{% endtabs %}

### 광고 정책 <a href="#policy" id="policy"></a>

#### 토스 애즈 SSP 정책 <a href="#ssp" id="ssp"></a>

아래 정책을 반드시 지켜주세요. 위반할 경우 광고 노출이 제한될 수 있어요.

**본 정책에 명시되지 않은 경우라도, 광고 노출·클릭·성과를 인위적으로 유도하거나 이용자 오인을 발생시키는 행위는 정책 위반으로 간주될 수 있어요.**

모든 파트너사는 정책 위반으로 서비스가 종료되는 경우, 서비스 종료 정책을 준수해야 해요.

| 유형              | 금지 행위                                                                                  | 구체적 예시                                                                                                                                                                                                                                                                                                                                                                                                                   | 정책 기준                                                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| UI/UX 품질 저하     | 광고와 콘텐츠의 구분을 불명확하게 하거나, 사용자 의도와 무관한 광고 소비 또는 클릭을 유도하거나, 정상적인 서비스 이용을 방해하도록 UI를 구성하는 행위 | <p></p><ul><li>"추천 서비스", "금융 팁" 등으로 광고를 위장</li><li>Toss Ads 가이드 외 광고 단위의 색상·글꼴 변경</li><li>광고의 타이틀·라벨·CTA 문구 및 디자인 임의 수정</li><li>사용자 상호작용 요소(버튼, 게임 플레이 영역 등)와 인접하게 광고를 배치하여 의도치 않은 클릭이 발생하도록 하는 구조</li><li>동일 화면에 동일 포맷 광고를 2개 이상 배치하는 경우</li><li>사용자가 정상적으로 화면을 종료하거나 이전 화면으로 이동하기 어렵게 하는 막다른(Dead-end) 구조</li><li>광고와 서비스 CTA의 기능을 사용자가 구분하기 어렵게 구성한 구조</li><li>서비스의 정상적인 이용에 필요한 CTA를 인지하거나 접근하기 어렵게 구성한 구조</li></ul> | <p></p><ul><li>광고는 반드시 "Ad" 표기를 유지해야 함</li><li>모든 광고 UI는 web-base 표준 컴포넌트를 사용해야 함</li><li>광고 성과를 인위적으로 유도하거나 사용자 경험을 저해하는 UI/UX 구성 금지</li></ul> |
| 광고 호출 동작 변조     | SDK 기본 이벤트 흐름이나 광고 호출 방식을 변경하거나 우회하는 행위                                                | <ul><li>SDK Click / Impression 이벤트 변조</li><li>광고 SDK를 거치지 않고 자체 로직으로 광고를 호출하거나 SDK 이벤트를 우회하여 구현하는 경우</li><li>Back 버튼을 차단하거나 비정상적으로 제어하여 사용자의 정상적인 화면 종료 또는 이전 화면 이동을 방해하는 경우</li></ul>                                                                                                                                                                                                                                   | <p></p><ul><li>SDK 기본 이벤트(Click / Impression) 구조 변조 금지</li><li>SDK 외부 API 호출 불가</li></ul>                                                       |
| 비정상 트래픽 및 성과 조작 | 자동화 또는 인위적 방식으로 트래픽 및 광고 성과를 왜곡하는 행위                                                   | <ul><li>광고 영역을 주기적으로 Refresh 처리</li><li>인위적으로 성과(클릭·노출 등)를 발생시키는 활동</li></ul>                                                                                                                                                                                                                                                                                                                                            | <ul><li>트래픽 품질 기반의 비정상 패턴이 확인될 경우 광고 제한, 제재, 정산 보류</li></ul>                                                                                    |
| 보상·참여형 클릭 유도    | 광고 클릭과 동시에 보상 또는 혜택을 제공하는 행위                                                           | <ul><li>"광고 클릭 즉시 리워드 제공"</li><li>"광고 클릭하면 포인트 제공"</li></ul>                                                                                                                                                                                                                                                                                                                                                             | <ul><li>광고 소비를 보상과 직접 연결하는 구조 금지</li><li>클릭 보상성 문구·이벤트 연동 금지</li></ul>                                                                          |
| 광고 은닉 또는 겹침     | 광고를 의도적으로 숨기거나 다른 UI 요소에 가려 사용자가 광고의 존재를 명확히 인지하기 어렵게 만드는 행위                           | <p>• 투명 광고 </p><p>• 다른 카드 UI 뒤에 광고 DOM 삽입</p>                                                                                                                                                                                                                                                                                                                                                                            | • 광고는 노출 상태가 명확히 확인 가능해야 함                                                                                                                      |

***

#### **UX / Product Principle 운영 원칙**

광고도 토스의 UX 원칙을 따라야 해요.

| **Toss Principle**             | **적용 기준**                                        | **예시**                     |
| ------------------------------ | ------------------------------------------------ | -------------------------- |
| **Simplicity**                 | 광고는 명료해야 하며, 추가 설명 없이 의미를 이해할 수 있어야 함            | "지금 보기", "광고 보기" 등 명확한 CTA |
| **Clear Action**               | 광고 클릭 후 어떤 행동이 발생할지 사용자가 예측 가능해야 함               | 외부 이동 시 고지 문구 제공           |
| **No Deception (UX Red Rule)** | 광고가 예상하지 못한 순간, 형태, 위치에서 등장하거나 사용자를 오인하게 해서는 안 됨 | 광고를 콘텐츠처럼 위장하는 경우          |
| **Value First**                | 광고는 고객의 서비스 목표를 방해하지 않아야 함                       | 결제/계좌 개설 흐름 중 광고 삽입 금지     |

#### **이용 제한 및 제재 조치**

앱인토스 광고 지면 또는 서비스가 본 정책을 위반한 경우 제재가 적용될 수 있어요.

***

**제한 절차**

제한 조치는 원칙적으로 위반 행위의 누적 정도에 따라 단계적으로 적용돼요. 다만, 위반의 유형이나 중대성에 따라 단일 위반에도 즉시 30일 이용 제한 또는 영구 이용 제한이 적용될 수 있어요.

※ 동시에 확인된 위반은 위반 슬롯의 개수와 관계없이 1회 위반으로 처리돼요. 이후 별도로 위반이 확인되는 경우 위반 횟수가 누적돼요.

<figure><img src="/files/mbFPCjlE7fei5CJJjDWd" alt=""><figcaption></figcaption></figure>

***

**부당 수익 처리**

정책 위반, 무효 트래픽 또는 기타 부정한 방식으로 발생한 수익은 부당 수익으로 간주될 수 있어요.

부당 수익이 확인되면 해당 금액에 대해 지급 보류 또는 지급 거절이 이루어질 수 있으며, 이미 지급된 금액도 동일하게 환수될 수 있어요.

***

**이의제기 절차**

* 이용 제한 통지를 받은 경우 **30일 이내 이의제기를 신청**할 수 있어요.
  * 이의제기 자료는 채널톡을 통해 제출할 수 있어요.
* 제출된 자료는 내부 기준에 따라 검토되며, 필요한 경우 추가 자료를 요청할 수 있어요.
  * 검토에는 영업일 기준 약 1주일이 소요될 수 있어요.
  * 이의제기 신청에 대해서는 **제재가 적절했는지 여부를 중심으로 검토**하며, 위반 사항을 수정했거나 재발 방지 계획을 제출한 사실만으로는 제재가 해제되지 않아요.
  * 제출된 이의제기 자료를 통해 제재의 근거가 된 위반 사실이 인정되지 않거나 제재 판단에 명백한 오류가 있는 것으로 확인되는 경우에는 제재가 해제될 수 있어요.
* 반복적이거나 중대한 위반의 경우 서비스 이용이 영구적으로 제한될 수 있어요.

***

### 테스트하기

개발 단계에서는 반드시 테스트용 광고 ID를 사용해요. 실제 광고 ID로 테스트하면 정책 위반으로 간주해 불이익을 받을 수 있어요.

* 전면형 광고: `ait-ad-test-interstitial-id`
* 리워드 광고: `ait-ad-test-rewarded-id`
* 배너 광고 - 리스트형: `ait-ad-test-banner-id`
* 배너 광고 - 피드형: `ait-ad-test-native-image-id`

출시 전에 아래 항목을 꼭 확인해 주세요.

* 광고가 정상적으로 로드되는지 확인해요.
* 클릭 시 의도한 화면으로 이동하는지 확인해요.
* 뒤로 가기 동작이 정상적으로 작동하는지 확인해요.
* 결제나 인증 흐름을 방해하지 않는지 확인해요.

***

### 자주 묻는 질문

<details>

<summary>\"This feature is not supported in the current environment\" 에러가 발생해요</summary>

1. 토스 앱 환경에서 실행 중인지 확인해주세요.
2. 앱 버전이 요구사항을 충족하는지 확인해주세요.
3. `isSupported()` 메서드로 지원 여부를 먼저 확인해주세요.

</details>

<details>

<summary>광고가 로드되지 않아요</summary>

1. `adGroupId`(콘솔에서 발급받은 ID)가 올바른지 확인해주세요.
2. 네트워크 연결 상태를 확인해주세요.
3. `onError` 콜백의 메시지를 확인해주세요.
4. 개발 환경에서는 테스트용 `adGroupId`를 사용해주세요. (예: `ait.dev.43daa14da3ae487b`)

</details>

<details>

<summary>광고 로드 함수 호출 후 이벤트는 보통 몇 초 안에 오나요?</summary>

어떤 네트워크의 광고가 노출되는지에 따라 소요 시간이 달라요.

```
**토스 애즈**: 보통 1~2초 이내에 로드돼요. 네트워크 상황에 따라 최대 10초까지 걸릴 수 있어요.
**구글 애드몹**: 일반적으로 5~20초 정도 소요되고, 그 이상 걸릴 수도 있어요. 사용자의 네트워크 상황에 영향을 많이 받아 최대 네트워크 타임아웃인 60초까지 지연될 수 있어요.
```

어떤 네트워크가 선택될지는 환경에 따라 SDK가 자동으로 결정하기 때문에, 광고를 표시할 화면으로 진입하기 전에 미리 로드해 두는 것을 권장해요.

</details>

<details>

<summary>showFullScreenAd를 호출했는데 광고가 표시되지 않아요</summary>

1. `loadFullScreenAd`를 먼저 호출하고 `loaded` 이벤트를 받았는지 확인해주세요.
2. 동일한 `adGroupId`를 사용했는지 확인해주세요.
3. 이미 표시된 광고는 다시 표시할 수 없으므로, 새로 로드가 필요해요.
4. `failedToShow` 이벤트나 `onError` 콜백에서 에러를 확인해주세요.

</details>

<details>

<summary>리워드가 지급되지 않아요</summary>

1. `userEarnedReward` 이벤트가 발생했는지 확인해주세요.
2. 사용자가 광고를 끝까지 시청했는지 확인해주세요. (중간에 닫으면 리워드 미지급)
3. `event.data`에서 `unitType`과 `unitAmount`를 확인해주세요.

</details>

<details>

<summary>dismissed 이벤트가 발생하지 않아요</summary>

Android 토스앱 5.255.0 버전에서는 `dismissed` 이벤트가 발생하지 않아요. 해당 버전 외에서는 정상 동작해요.

</details>

<details>

<summary>광고 로드 이벤트가 간헐적으로 전달되지 않아요</summary>

Android 토스앱 5.266.0 버전에서 광고 로드 함수를 호출한 후 이벤트를 받기 전에 추가로 로드를 호출하면, 추가 호출 건에 대한 이벤트가 간헐적으로 전달되지 않는 이슈가 있었어요.

서버 로직을 롤백하여 이슈를 해결했지만, 간헐적으로 캐시가 남아 동일한 현상이 재발하는 경우 사용자에게 토스앱 프로세스 종료 후 재실행이 필요할 수 있었어요.

이슈가 있던 동안에는 아래 가이드 적용이 필요해요.

광고 그룹 ID는 반드시 1개씩 순차적으로 로드해 주세요. 미니앱에서 여러 광고 그룹 ID를 동시에 로드하면 정상적으로 처리되지 않아요. 전면형/보상형은 각각 로드가 필요해요. (예: 전면형 그룹 ID 로드 → 이벤트 수신 → 보상형 그룹 ID 로드 → 이벤트 수신 → 표시) 광고 로드 함수 호출 후 이벤트를 받은 이후에 광고 표시 함수를 호출해 주세요. 배너 광고는 해당되지 않아요.

Android 5.267.0 버전부터는 위 이슈가 개선되어 토스앱 재실행이 불필요해졌고, 하나의 미니앱에서 복수 개의 전면 광고 인스턴스를 미리 로드해 둘 수 있도록 수정되었어요.

</details>

<details>

<summary>loaded 이벤트가 발생하지 않아요</summary>

Android 5.266.0 버전 이상에서 전면형/보상형 광고와 배너 광고를 동시에 로드하는 경우, 전면형/보상형 광고의 이벤트가 전달되지 않아요.

이슈가 있던 동안에는 아래 가이드 적용이 필요해요.

광고 그룹 ID는 반드시 1개씩 순차적으로 로드해 주세요. 미니앱에서 여러 광고 그룹 ID를 동시에 로드하면 정상적으로 처리되지 않아요. 전면형/보상형/배너 광고는 각각 로드가 필요해요. (예: 전면형 그룹 ID 로드 → 이벤트 수신 → 배너 ID 로드 → 이벤트 수신 → 표시) 광고 로드 함수 호출 후 이벤트를 받은 이후에 광고 표시 함수를 호출해 주세요.

Android 5.268.0 버전부터 개선될 예정이에요.

</details>

<details>

<summary>샌드박스에서 인앱 광고 기능이 되지 않아요</summary>

샌드박스에서는 인앱 광고 기능을 지원하지 않아요.

불편하시겠지만 콘솔 내 QR 코드로 테스트를 진행해 주세요.

</details>


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa/interstitial-rewarded-ad.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
