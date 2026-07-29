<script setup lang="ts">
import UiIcon from '@/shared/UiIcon.vue'

// 개인정보처리방침과 같은 이유로 운영 언어(한국어)로만 제공한다.
// Google Play 데이터 보안 양식의 '계정 삭제 URL'로 등록되는 페이지라
// 앱 이름·삭제 절차·삭제 항목·보관 기간이 모두 적혀 있어야 한다.
const CONTACT_EMAIL = 'tngus842655@gmail.com'
</script>

<template>
  <div class="deletion">
    <header class="deletion-header">
      <RouterLink class="back" to="/settings"><UiIcon name="back" /></RouterLink>
      <div>
        <h1>계정 및 데이터 삭제</h1>
        <p class="effective">미니게임30 (MiniGame30)</p>
      </div>
    </header>

    <div class="card">
      <p class="intro">
        미니게임30 계정과 그동안 쌓인 게임 기록을 지우고 싶을 때는 아래 절차를 따라주세요.
      </p>

      <h2>삭제 요청 방법</h2>
      <ol>
        <li>아래 이메일 주소로 메일을 보냅니다.</li>
        <li>제목에 <strong>계정 삭제 요청</strong>이라고 적습니다.</li>
        <li>
          본문에 앱에서 쓰던 <strong>닉네임</strong>을 적습니다. 구글이나 카카오 계정을 연동해
          두었다면 연동한 계정의 이메일 주소도 함께 적어주세요. 계정을 찾는 데 쓰입니다.
        </li>
      </ol>
      <p class="contact">{{ CONTACT_EMAIL }}</p>
      <p class="note">
        본인 확인 후 영업일 기준 7일 이내에 처리하고, 완료되면 회신드립니다.
      </p>

      <h2>삭제되는 항목</h2>
      <ul>
        <li>계정 정보: 익명 식별자, 닉네임</li>
        <li>SNS 연동 정보: 구글·카카오 계정 식별자, 프로필 사진, 이메일 주소</li>
        <li>게임 기록: 게임별 점수, 랭킹 기록, 플레이 시간</li>
      </ul>
      <p class="note">
        삭제 후에는 랭킹에서도 함께 사라지며, 되돌릴 수 없습니다. 앱을 다시 실행하면 새 익명
        계정으로 처음부터 시작됩니다.
      </p>

      <h2>보관되는 항목</h2>
      <p>
        게임별 플레이 횟수처럼 개인을 식별할 수 없는 형태로 집계된 통계는 삭제 후에도 남습니다.
        누가 플레이했는지 알 수 없는 숫자만 남기 때문에 개인정보에 해당하지 않습니다.
      </p>
      <p>
        그 밖에 개인을 식별할 수 있는 정보는 별도로 보관하지 않으며, 삭제 요청 처리와 동시에
        지워집니다.
      </p>

      <h2>앱을 지우기만 하면 되나요?</h2>
      <p>
        앱 삭제만으로는 서버에 저장된 기록이 지워지지 않습니다. 기록까지 지우려면 위 절차대로
        요청해주세요.
      </p>
    </div>
  </div>
</template>

<style scoped>
.deletion {
  padding: 20px 16px 40px;
}

.deletion-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.deletion-header h1 {
  font-size: 20px;
}

.effective {
  margin-top: 4px;
  font-size: 12.5px;
  color: #bcaaa4;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 18px 16px;
}

.intro {
  margin-bottom: 4px;
}

.card h2 {
  font-size: 15px;
  margin: 18px 0 8px;
}

.card p,
.card li {
  font-size: 13.5px;
  line-height: 1.6;
  color: #5d4037;
  word-break: keep-all;
}

.card ul,
.card ol {
  padding-left: 18px;
}

.card li {
  margin-bottom: 4px;
}

.note {
  margin-top: 6px;
  font-size: 12.5px;
  color: #8d6e63;
}

.contact {
  margin-top: 10px;
  font-weight: bold;
}
</style>
