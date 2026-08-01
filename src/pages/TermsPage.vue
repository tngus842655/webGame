<script setup lang="ts">
import { t } from '@/shared/i18n'
import UiIcon from '@/shared/UiIcon.vue'

// 개인정보처리방침과 같은 이유로 운영 언어(한국어)로만 제공한다 —
// 법적 고지 문서라 임의 번역 시 효력 문제가 생길 수 있다 (PrivacyPage.vue 주석 참고).
const CONTACT_EMAIL = 'tngus842655@gmail.com'
</script>

<template>
  <div class="terms">
    <header class="terms-header">
      <RouterLink class="back" to="/settings"><UiIcon name="back" /></RouterLink>
      <div>
        <h1>{{ t('terms.title') }}</h1>
        <p class="effective">시행일자 2026년 8월 1일</p>
      </div>
    </header>

    <div class="card">
      <p class="intro">
        이 약관은 미니게임30(이하 "서비스")을 이용하는 데 필요한 사항을 정합니다. 서비스는
        무료로 제공되며, 별도의 가입 절차 없이 이용할 수 있습니다.
      </p>

      <h2>1. 약관의 효력과 변경</h2>
      <p>
        이 약관은 서비스 화면에 게시함으로써 효력이 생깁니다. 내용이 바뀌는 경우 시행일자를
        고쳐 다시 게시하며, 변경된 약관에 동의하지 않으면 서비스 이용을 중단하고 계정 삭제를
        요청할 수 있습니다.
      </p>

      <h2>2. 서비스의 내용</h2>
      <ul>
        <li>여러 개의 미니게임 제공</li>
        <li>게임별 최고 점수 저장과 주간·전체 랭킹</li>
        <li>광고 시청을 통한 게임 내 보상(추가 기회, 점수 두 배 등)</li>
      </ul>
      <p class="note">
        모든 기능은 무료이며, 서비스 안에서 현금이나 유료 재화를 결제하는 절차는 없습니다.
      </p>

      <h2>3. 계정</h2>
      <p>
        서비스를 처음 시작하면 이용자를 식별하기 위한 익명 계정이 자동으로 만들어집니다. 이
        계정은 앱을 설치한 기기에만 남으므로, 앱을 지우거나 저장 공간을 비우면 기록을 되찾지
        못할 수 있습니다.
      </p>
      <p>
        구글 또는 카카오 계정을 연동하면 기기를 바꾸어도 같은 기록을 이어서 쓸 수 있습니다.
        연동은 선택 사항이며, 하지 않아도 모든 게임을 그대로 즐길 수 있습니다.
      </p>

      <h2>4. 닉네임</h2>
      <p>
        닉네임은 랭킹에 그대로 공개됩니다. 다른 사람을 사칭하거나, 욕설·차별 표현이 담기거나,
        타인의 권리를 침해하는 닉네임은 사전 통지 없이 변경될 수 있습니다.
      </p>

      <h2>5. 이용자의 의무</h2>
      <p>이용자는 다음의 행위를 해서는 안 됩니다.</p>
      <ul>
        <li>정상적인 플레이가 아닌 방법으로 점수를 만들어 랭킹에 올리는 행위</li>
        <li>서비스의 데이터나 통신을 조작·변조하는 행위</li>
        <li>자동화 도구를 사용해 반복적으로 서비스에 접근하는 행위</li>
        <li>서비스를 역설계하거나 무단으로 복제·배포하는 행위</li>
        <li>다른 이용자의 계정을 도용하거나 서비스 운영을 방해하는 행위</li>
      </ul>

      <h2>6. 기록의 정정과 이용 제한</h2>
      <p>
        정상적인 플레이로 나올 수 없는 기록은 사전 통지 없이 삭제될 수 있습니다. 제5조를
        반복해서 어기는 경우 계정의 랭킹 등록이 제한될 수 있습니다.
      </p>

      <h2>7. 광고</h2>
      <p>
        서비스는 보상형 광고를 제공하며, 광고 시청은 전적으로 이용자의 선택입니다. 광고를 보지
        않아도 모든 게임을 플레이할 수 있습니다. 광고의 내용과 그 광고로 연결되는 사이트에
        대해서는 해당 광고주가 책임을 집니다.
      </p>

      <h2>8. 서비스의 변경과 중단</h2>
      <p>
        서비스는 게임을 추가하거나 목록에서 내릴 수 있습니다. 목록에서 내려간 게임은 홈 화면
        아래 휴지통에서 계속 즐길 수 있으나, 일정 기간이 지나면 완전히 제거될 수 있습니다.
      </p>
      <p>
        서비스 전체를 종료하는 경우에는 서비스 화면에 미리 공지합니다.
      </p>

      <h2>9. 지식재산권</h2>
      <p>
        서비스에 포함된 게임, 그림, 글, 프로그램에 대한 권리는 서비스 제공자에게 있습니다.
        이용자는 개인적으로 즐기는 범위를 넘어 이를 복제·배포하거나 2차적으로 이용할 수
        없습니다.
      </p>

      <h2>10. 책임의 한계</h2>
      <p>
        서비스는 무료로 제공되며, 천재지변·통신 장애·이용자 기기의 문제 등 서비스 제공자의
        책임이 아닌 사유로 발생한 손해에 대해서는 책임을 지지 않습니다. 기기에만 저장된 기록의
        분실에 대해서도 같습니다.
      </p>

      <h2>11. 문의</h2>
      <p>서비스 이용과 관련한 문의는 아래 이메일로 연락해주시기 바랍니다.</p>
      <p class="contact">{{ CONTACT_EMAIL }}</p>

      <h2>12. 준거법</h2>
      <p>
        이 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련한 분쟁은 민사소송법이 정한
        관할 법원에서 다룹니다.
      </p>
    </div>
  </div>
</template>

<style scoped>
.terms {
  padding: 20px 16px 40px;
}

.terms-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.terms-header h1 {
  font-size: 20px;
}

.effective {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--ink-faint);
}

.card {
  background: var(--surface);
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
  color: var(--ink-body);
  word-break: keep-all;
}

.card p + p {
  margin-top: 8px;
}

.card ul {
  padding-left: 18px;
}

.card li {
  margin-bottom: 4px;
}

.note {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--ink-muted);
}

.contact {
  margin-top: 6px;
  font-weight: bold;
}
</style>
