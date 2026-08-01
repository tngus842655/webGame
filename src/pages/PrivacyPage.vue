<script setup lang="ts">
import { t } from '@/shared/i18n'
import UiIcon from '@/shared/UiIcon.vue'

// 법적 고지 문서라 임의 번역 시 효력 문제가 생길 수 있어 운영 언어(한국어)로만 제공한다.
// 문의처는 운영자 연락 이메일과 일치시킬 것.
const CONTACT_EMAIL = 'tngus842655@gmail.com'
</script>

<template>
  <div class="privacy">
    <header class="privacy-header">
      <RouterLink class="back" to="/settings"><UiIcon name="back" /></RouterLink>
      <div>
        <h1>{{ t('privacy.title') }}</h1>
        <p class="effective">시행일자 2026년 7월 25일</p>
      </div>
    </header>

    <div class="card">
      <p class="intro">
        미니게임30(이하 "서비스")은 이용자의 개인정보를 중요하게 생각하며, 아래와 같이
        개인정보를 수집·이용합니다. 서비스는 회원가입 없이 이용할 수 있으며, 꼭 필요한
        최소한의 정보만 다룹니다.
      </p>

      <h2>1. 수집하는 개인정보 항목</h2>
      <ul>
        <li>계정 정보: 첫 접속 시 자동 발급되는 익명 식별자, 닉네임</li>
        <li>SNS 연동 시(선택): 구글·카카오 계정 식별자, 닉네임, 프로필 사진, 이메일 주소</li>
        <li>서비스 이용 정보: 게임 점수, 플레이 시간</li>
      </ul>
      <p class="note">언어·사운드 설정과 일부 게임의 진행 상황은 이용자의 브라우저에만 저장되며 서버로 전송되지 않습니다.</p>

      <h2>2. 개인정보의 수집·이용 목적</h2>
      <ul>
        <li>게임 점수 저장 및 랭킹 서비스 제공</li>
        <li>기기 변경 시 SNS 계정을 통한 기존 기록 복구</li>
        <li>게임별 인기 순위 등 통계 산출 (개인을 식별하지 않는 형태로 집계)</li>
      </ul>

      <h2>3. 개인정보의 보유 및 이용 기간</h2>
      <p>
        서비스 제공 기간 동안 보유하며, 이용자가 삭제를 요청하면 계정과 게임 기록을 지체
        없이 삭제합니다.
      </p>

      <h2>4. 개인정보의 처리 위탁</h2>
      <p>서비스는 개인정보를 제3자에게 제공하지 않으며, 운영을 위해 아래 업체에 처리를 위탁합니다. 위탁 업체의 서버는 국외(미국)에 위치할 수 있습니다.</p>
      <ul>
        <li>Supabase Inc. — 계정 인증, 데이터베이스 보관</li>
        <li>Vercel Inc. — 웹 호스팅, 콘텐츠 전송</li>
      </ul>

      <h2>5. 이용자의 권리</h2>
      <p>
        닉네임은 설정에서 언제든지 직접 변경할 수 있으며, 아래 문의처를 통해 본인 기록의
        열람·삭제를 요청할 수 있습니다.
      </p>

      <h2>6. 안전성 확보 조치</h2>
      <p>
        모든 통신 구간은 암호화(HTTPS)되며, 게임 기록은 본인 계정만 기록할 수 있도록 접근을
        제한합니다. 비밀번호는 별도로 수집·보관하지 않습니다.
      </p>

      <h2>7. 개인정보 보호 문의</h2>
      <p>개인정보 관련 문의사항은 아래 이메일로 연락해주시기 바랍니다.</p>
      <p class="contact">{{ CONTACT_EMAIL }}</p>
    </div>
  </div>
</template>

<style scoped>
.privacy {
  padding: 20px 16px 40px;
}

.privacy-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.privacy-header h1 {
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
