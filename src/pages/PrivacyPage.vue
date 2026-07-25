<script setup lang="ts">
import { t } from '@/shared/i18n'

// 법적 고지 문서라 임의 번역 시 효력 문제가 생길 수 있어 운영 언어(한국어)로만 제공한다.
// 문의처는 운영자 연락 이메일과 일치시킬 것.
const CONTACT_EMAIL = 'tngus842655@gmail.com'
</script>

<template>
  <div class="privacy">
    <header class="privacy-header">
      <RouterLink class="back" to="/settings">←</RouterLink>
      <h1>{{ t('privacy.title') }}</h1>
    </header>

    <p class="intro">
      미니게임30(이하 "서비스")은 개인정보 보호법 등 관련 법령을 준수하며, 이용자의 개인정보를
      아래와 같이 처리합니다. 서비스는 회원가입 절차 없이 이용할 수 있도록 설계되어 있으며,
      꼭 필요한 최소한의 정보만 다룹니다.
    </p>

    <section class="card">
      <h2>1. 수집하는 개인정보 항목과 방법</h2>
      <h3>서비스 이용 과정에서 자동으로 생성·수집되는 정보</h3>
      <ul>
        <li>익명 계정 식별자 — 첫 접속 시 자동으로 발급되는 무작위 값으로, 이름·연락처 등 실제 신원 정보를 포함하지 않습니다.</li>
        <li>닉네임 — 자동 생성된 기본 닉네임 또는 이용자가 직접 입력한 닉네임</li>
        <li>게임 이용 기록 — 게임별 점수, 플레이 시간, 플레이 일시</li>
      </ul>
      <h3>SNS 계정 연동 시 수집되는 정보 (선택)</h3>
      <ul>
        <li>구글: 계정 식별자, 이름, 프로필 사진, 이메일 주소</li>
        <li>카카오: 계정 식별자, 닉네임, 프로필 사진, 이메일 주소(이용자가 동의한 경우에 한함)</li>
      </ul>
      <p>
        SNS 연동은 선택 사항이며, 연동하지 않아도 서비스의 모든 기능을 이용할 수 있습니다.
        연동 시 수집되는 정보 중 실제로 서비스에 활용되는 것은 계정 식별자와 닉네임뿐입니다.
      </p>
      <h3>이용자의 기기에만 저장되는 정보</h3>
      <ul>
        <li>게임별 최고 점수, 언어·사운드 설정, 일부 게임의 진행 상황</li>
      </ul>
      <p>위 정보는 브라우저(localStorage)에만 저장되며 서비스 서버로 전송되지 않습니다.</p>
    </section>

    <section class="card">
      <h2>2. 개인정보의 이용 목적</h2>
      <ul>
        <li>게임 점수 저장과 랭킹 서비스 제공</li>
        <li>기기 변경 시 SNS 계정을 통한 기존 기록 복구</li>
        <li>게임별 인기 순위 등 통계 산출 (개인을 식별하지 않는 형태로 집계)</li>
      </ul>
    </section>

    <section class="card">
      <h2>3. 보유 및 이용 기간</h2>
      <p>
        수집된 정보는 서비스 제공 기간 동안 보유하며, 이용자가 삭제를 요청한 경우 지체 없이
        파기합니다. 계정이 삭제되면 해당 계정의 닉네임과 게임 기록도 함께 삭제됩니다.
      </p>
    </section>

    <section class="card">
      <h2>4. 개인정보의 제3자 제공</h2>
      <p>서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다.</p>
    </section>

    <section class="card">
      <h2>5. 처리 위탁 및 국외 이전</h2>
      <p>서비스 운영을 위해 아래 업체에 개인정보 처리를 위탁하고 있으며, 해당 업체의 서버는 국외에 위치할 수 있습니다.</p>
      <ul>
        <li>Supabase Inc.(미국) — 계정 인증, 데이터베이스 보관</li>
        <li>Cloudflare Inc.(미국) — 웹 호스팅, 콘텐츠 전송</li>
      </ul>
    </section>

    <section class="card">
      <h2>6. 이용자의 권리</h2>
      <p>
        이용자는 언제든지 자신의 닉네임을 서비스 내 설정에서 직접 변경할 수 있으며, 아래
        문의처를 통해 본인 기록의 열람·정정·삭제를 요청할 수 있습니다. 요청 시 본인 확인을
        위해 연동된 SNS 계정 정보를 확인할 수 있습니다.
      </p>
    </section>

    <section class="card">
      <h2>7. 안전성 확보 조치</h2>
      <ul>
        <li>모든 통신 구간 암호화(HTTPS) 적용</li>
        <li>데이터베이스 접근 제어 — 본인 계정의 기록만 기록·수정할 수 있도록 제한</li>
        <li>비밀번호를 별도로 수집·보관하지 않음 (SNS 계정 인증 방식 사용)</li>
      </ul>
    </section>

    <section class="card">
      <h2>8. 개인정보 보호책임자 및 문의처</h2>
      <p>
        개인정보 처리에 관한 문의, 열람·삭제 요청은 아래 이메일로 연락해 주세요.
        확인 후 지체 없이 답변드리겠습니다.
      </p>
      <p class="contact">{{ CONTACT_EMAIL }}</p>
    </section>

    <p class="effective">이 개인정보처리방침은 2026년 7월 25일부터 적용됩니다.</p>
  </div>
</template>

<style scoped>
.privacy {
  padding: 20px 16px 40px;
}

.privacy-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.back {
  font-size: 22px;
  padding: 4px 8px;
}

.privacy-header h1 {
  font-size: 20px;
}

.intro {
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.6;
  color: #5d4037;
  word-break: keep-all;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
}

.card h2 {
  font-size: 15px;
  margin-bottom: 10px;
}

.card h3 {
  font-size: 13.5px;
  margin: 12px 0 6px;
  color: #6d4c41;
}

.card p,
.card li {
  font-size: 13.5px;
  line-height: 1.6;
  color: #5d4037;
  word-break: keep-all;
}

.card p {
  margin-top: 8px;
}

.card ul {
  padding-left: 18px;
}

.card li {
  margin-bottom: 4px;
}

.contact {
  font-weight: bold;
}

.effective {
  margin-top: 16px;
  font-size: 12.5px;
  color: #bcaaa4;
  text-align: center;
}
</style>
