---
url: 'https://developers-apps-in-toss.toss.im/user-hash-key/develop.md'
description: 사용자 식별키 발급 서비스 소개와 연동 방법을 안내해요.
---

# 사용자 식별키 발급

사용자 식별키 발급은 별도의 서버나 사용자 동의 절차 없이도 미니앱 안에서 사용자를 안정적으로 식별할 수 있도록 돕는 기능이에요.

::: tip 토스 로그인 마이그레이션
기존에 토스 로그인으로 사용자를 식별하고 있었다면, 사용자 식별키 발급으로 전환할 수 있어요.\
[마이그레이션 가이드](/user-hash-key/migration.html)를 참고해 주세요.
:::

미니앱 유형에 따라 사용하는 함수가 달라요.

| 미니앱 유형 | 함수                | 설명                                         |
| ----------- | ------------------- | -------------------------------------------- |
| 게임        | `getUserKeyForGame` | 게임 미니앱 전용 사용자 식별키를 반환해요.   |
| 비게임      | `getAnonymousKey`   | 비게임 미니앱 전용 사용자 식별키를 반환해요. |

두 함수 모두 서버 연동 없이 사용자를 식별할 수 있는 **고유 키 값(hash)** 을 반환해요.\
반환되는 사용자 식별자는 미니앱별로 고유해요.

::: tip 꼭 확인해 주세요

* 고유 키 값(`hash`) 값은 같은 미니앱 안에서 동일한 사용자에게 항상 같은 값이 반환돼요.
* 각 함수는 해당 카테고리 미니앱에서만 사용할 수 있어요. 잘못된 카테고리에서 호출하면 오류가 발생해요.
* 샌드박스에서는 mock 데이터가 반환되므로, QR 코드로 테스트해 주세요.

:::

***

## 게임 미니앱

**SDK 함수:** `getUserKeyForGame`

`getUserKeyForGame`은 게임 미니앱에서 사용자를 식별하기 위한 전용 API예요.\
토스 로그인처럼 별도의 인증 화면이나 서버 연동 없이, 게임 미니앱 내부에서 고유한 사용자 식별자를 바로 얻을 수 있어요.

이 함수는 **게임 카테고리 미니앱에서만 사용 가능**하며, 반환되는 사용자 식별자(`hash`)는 **미니앱(게임)별로 고유**해요.\
이 값은 게임 내 데이터 저장, 랭킹 관리 등에 사용할 수 있어요.

::: tip 주의하세요

* 이 함수는 **게임 카테고리 미니앱에서만 사용 가능**해요. 비게임 미니앱에서 호출하면 `'INVALID_CATEGORY'`를 반환해요.
* **토스앱 5.232.0 이상**에서만 지원돼요. 그 이하 버전에서는 `undefined`를 반환해요.
* 모든 사용자의 식별자를 안정적으로 제공하기 위해 **게임 미니앱의 최소 지원 토스앱 버전이 5.232.0으로 상향**됐어요.
  * 지원 버전 미만에서는 미니앱 진입 시 업데이트 안내 화면이 표시돼요.
* 반환되는 사용자 키는 **토스 서버 API 호출용 키가 아니에요.**
  * 게임사 내부 사용자 식별, 데이터 관리 용도로만 사용해 주세요.
* 샌드박스 환경에서는 **mock 데이터**가 내려와요. 실제 동작은 QR 코드로 토스앱에서 테스트해 주세요.

:::

**시그니처**

```typescript
function getUserKeyForGame(): Promise<GetUserKeyForGameSuccessResponse | 'INVALID_CATEGORY' | 'ERROR' | undefined>;
```

**반환 값**

* `GetUserKeyForGameSuccessResponse`: 사용자 키 조회에 성공했어요. `{ type: 'HASH', hash: string }` 형태로 반환돼요.
  * `hash` 값은 해당 게임 미니앱에서만 유효한 사용자 식별자예요.
* `'INVALID_CATEGORY'`: 게임 카테고리가 아닌 미니앱에서 호출했어요.
* `'ERROR'`: 알 수 없는 오류가 발생했어요.
* `undefined`: 앱 버전이 최소 지원 버전보다 낮아요.

**예제 : 게임 사용자 식별자 가져오기**

아래 예제는 게임 미니앱에서 `getUserKeyForGame`을 호출해 사용자 식별자를 받아 처리하는 기본적인 흐름을 보여줘요.

::: code-group

```js [js]
import { getUserKeyForGame } from '@apps-in-toss/web-framework';

async function handleGetUserKey() {
  const result = await getUserKeyForGame();

  if (!result) {
    console.warn('지원하지 않는 앱 버전이에요.');
  } else if (result === 'INVALID_CATEGORY') {
    console.error('게임 카테고리가 아닌 미니앱이에요.');
  } else if (result === 'ERROR') {
    console.error('사용자 키 조회 중 오류가 발생했어요.');
  } else if (result.type === 'HASH') {
    console.log('사용자 키:', result.hash);
    // 여기에서 사용자 키를 사용해 게임 데이터를 관리할 수 있어요.
  }
}
```

```tsx [React]
import { getUserKeyForGame } from '@apps-in-toss/web-framework';

function GameUserKeyButton() {
  async function handleClick() {
    const result = await getUserKeyForGame();

    if (!result) {
      console.warn('지원하지 않는 앱 버전이에요.');
      return;
    }

    if (result === 'INVALID_CATEGORY') {
      console.error('게임 카테고리가 아닌 미니앱이에요.');
      return;
    }

    if (result === 'ERROR') {
      console.error('사용자 키 조회 중 오류가 발생했어요.');
      return;
    }

    if (result.type === 'HASH') {
      console.log('사용자 키:', result.hash);
      // 여기에서 사용자 키를 사용해 게임 데이터를 관리할 수 있어요.
    }
  }

  return <button onClick={handleClick}>사용자 키 가져오기</button>;
}
```

```tsx [React Native]
import { Button } from 'react-native';
import { getUserKeyForGame } from '@apps-in-toss/framework';

function GameUserKeyButton() {
  async function handlePress() {
    const result = await getUserKeyForGame();

    if (!result) {
      console.warn('지원하지 않는 앱 버전이에요.');
      return;
    }

    if (result === 'INVALID_CATEGORY') {
      console.error('게임 카테고리가 아닌 미니앱이에요.');
      return;
    }

    if (result === 'ERROR') {
      console.error('사용자 키 조회 중 오류가 발생했어요.');
      return;
    }

    if (result.type === 'HASH') {
      console.log('사용자 키:', result.hash);
      // 여기에서 사용자 키를 사용해 게임 데이터를 관리할 수 있어요.
    }
  }

  return <Button onPress={handlePress} title="사용자 키 가져오기" />;
}
```

:::

**참고사항**

* `getUserKeyForGame`은 게임 미니앱 전용 로그인/식별 수단이에요.
* 토스 로그인(`appLogin`)과 달리 서버 API 연동 없이도 사용할 수 있어요.
* 게임 사용자 데이터(랭킹, 포인트, 세이브 데이터 등)는 이 사용자 키를 기준으로 관리하는 것을 권장해요.

***

## 비게임 미니앱

**SDK 함수:** `getAnonymousKey`

`getAnonymousKey`는 비게임 미니앱에서 사용자를 식별하기 위한 API예요.\
토스 로그인처럼 별도의 인증 화면이나 서버 연동 없이, 미니앱 내부에서 고유한 사용자 식별자를 바로 얻을 수 있어요.

이 함수는 **비게임 카테고리 미니앱에서만 사용 가능**하며, 반환되는 사용자 식별자(`hash`)는 **미니앱별로 고유**해요.

::: tip 주의하세요

* 이 함수는 **비게임 카테고리 미니앱에서만 사용 가능**해요. 게임 미니앱에서 호출하면 `'INVALID_CATEGORY'`를 반환해요.
* **SDK 2.4.5 이상**에서 지원돼요. 그 이하 버전에서는 `undefined`를 반환해요.
* 반환되는 사용자 키는 **토스 서버 API 호출용 키가 아니에요.**
  * 내부 사용자 식별, 데이터 관리 용도로만 사용해 주세요.
* 샌드박스 환경에서는 **mock 데이터**가 내려와요. 실제 동작은 QR 코드로 토스앱에서 테스트해 주세요.

:::

**시그니처**

```typescript
function getAnonymousKey(): Promise<GetAnonymousKeySuccessResponse | 'INVALID_CATEGORY' | 'ERROR' | undefined>;
```

**반환 값**

* `GetAnonymousKeySuccessResponse`: 사용자 키 조회에 성공했어요. `{ type: 'HASH', hash: string }` 형태로 반환돼요.
  * `hash` 값은 해당 미니앱에서만 유효한 사용자 식별자예요.
* `'INVALID_CATEGORY'`: 비게임 카테고리가 아닌 미니앱에서 호출했어요.
* `'ERROR'`: 알 수 없는 오류가 발생했어요.
* `undefined`: SDK 버전이 최소 지원 버전보다 낮아요.

**예제 : 사용자 식별자 가져오기**

아래 예제는 비게임 미니앱에서 `getAnonymousKey`를 호출해 사용자 식별자를 받아 처리하는 기본적인 흐름을 보여줘요.

::: code-group

```js [js]
import { getAnonymousKey } from '@apps-in-toss/web-framework';

async function handleGetUserKey() {
  const result = await getAnonymousKey();

  if (!result) {
    console.warn('지원하지 않는 SDK 버전이에요.');
  } else if (result === 'INVALID_CATEGORY') {
    console.error('비게임 카테고리가 아닌 미니앱이에요.');
  } else if (result === 'ERROR') {
    console.error('사용자 키 조회 중 오류가 발생했어요.');
  } else if (result.type === 'HASH') {
    console.log('사용자 키:', result.hash);
    // 여기에서 사용자 키를 사용해 데이터를 관리할 수 있어요.
  }
}
```

```tsx [React]
import { getAnonymousKey } from '@apps-in-toss/web-framework';

function UserKeyButton() {
  async function handleClick() {
    const result = await getAnonymousKey();

    if (!result) {
      console.warn('지원하지 않는 SDK 버전이에요.');
      return;
    }

    if (result === 'INVALID_CATEGORY') {
      console.error('비게임 카테고리가 아닌 미니앱이에요.');
      return;
    }

    if (result === 'ERROR') {
      console.error('사용자 키 조회 중 오류가 발생했어요.');
      return;
    }

    if (result.type === 'HASH') {
      console.log('사용자 키:', result.hash);
      // 여기에서 사용자 키를 사용해 데이터를 관리할 수 있어요.
    }
  }

  return <button onClick={handleClick}>사용자 키 가져오기</button>;
}
```

```tsx [React Native]
import { Button } from 'react-native';
import { getAnonymousKey } from '@apps-in-toss/framework';

function UserKeyButton() {
  async function handlePress() {
    const result = await getAnonymousKey();

    if (!result) {
      console.warn('지원하지 않는 SDK 버전이에요.');
      return;
    }

    if (result === 'INVALID_CATEGORY') {
      console.error('비게임 카테고리가 아닌 미니앱이에요.');
      return;
    }

    if (result === 'ERROR') {
      console.error('사용자 키 조회 중 오류가 발생했어요.');
      return;
    }

    if (result.type === 'HASH') {
      console.log('사용자 키:', result.hash);
      // 여기에서 사용자 키를 사용해 데이터를 관리할 수 있어요.
    }
  }

  return <Button onPress={handlePress} title="사용자 키 가져오기" />;
}
```

:::

**참고사항**

* `getAnonymousKey`는 비게임 미니앱 전용 사용자 식별 수단이에요.
* 토스 로그인(`appLogin`)과 달리 서버 API 연동 없이도 사용할 수 있어요.
* 사용자 데이터는 이 사용자 키를 기준으로 관리하는 것을 권장해요.

***

## 식별키 검증하기

사용자 식별키가 유효한지 검증할 때 사용해요.

**기본 정보**

| 항목         | 값                                 |
| ------------ | ---------------------------------- |
| Base URL     | `https://apps-in-toss-api.toss.im` |
| 서버 인증    | mTLS (클라이언트 인증서)           |
| Content-Type | `application/json`                 |

::: tip 서버 간 통신에는 mTLS 인증서가 필요해요

식별키 검증 API는 파트너 서버에서 앱인토스 서버로 호출하는 서버 간 통신이에요.\
보안을 위해 서버에 mTLS 인증서를 설정한 뒤 호출해 주세요.\
인증서 발급 방법은 [mTLS 인증서 발급 방법](/development/integration-process.html#mtls-인증서-발급-방법)을 참고해 주세요.

:::

* Method: `POST`
* Endpoint: `/api-partner/v1/apps-in-toss/users/anon-key/verify`
* Endpoint: `/api-partner/v1/apps-in-toss/users/anon-key/verify`

**요청 헤더**

| 이름         | 타입   | 필수 | 설명                                                                        |
| ------------ | ------ | ---- | --------------------------------------------------------------------------- |
| `x-anon-key` | string | Y    | [사용자 식별키 발급](/user-hash-key/develop.html)으로 받은 `hash` 값이에요. |

```bash
curl -X 'POST' \
  'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/users/anon-key/verify' \
  -H 'accept: application/json' \
  -H 'x-anon-key: anon-key' \
  -d ''
```

**응답 파라미터**

| 이름    | 타입   | 설명             |
| ------- | ------ | ---------------- |
| success | string | 식별키 유효 여부예요. 유효하면 `"true"`, 유효하지 않으면 에러 응답이 반환돼요. |

```json
{
  "resultType": "SUCCESS",
  "success": "true"
}
```

**에러 코드**

API 사용 중 발생할 수 있는 에러 코드 목록이에요.\
응답 코드나 메시지를 참고해 **적절한 예외 처리 로직**을 적용해 주세요.

| 코드  | 메시지                                                |
| ----- | ----------------------------------------------------- |
| `401` | 사용자 식별키가 없거나 매핑된 사용자를 찾을 수 없어요 |
