---
url: 'https://developers-apps-in-toss.toss.im/prepare/console-mcp.md'
description: Claude에서 Apps in Toss 콘솔 MCP를 연결해 콘솔 작업을 실행하는 방법을 안내해요.
---

# AI로 콘솔 사용하기

Apps in Toss 콘솔 MCP를 연결하면 콘솔에 직접 들어가지 않아도 Claude에서 워크스페이스, 미니앱, 검수, 번들, 인앱 결제, 인앱 광고 같은 작업을 실행할 수 있어요.\
AI에게 자연어로 요청해 콘솔 정보를 조회하거나 필요한 작업을 진행할 수 있어요.\
현재 콘솔 MCP는 Claude에서만 사용할 수 있어요. Codex 지원은 준비 중이에요.

***

## 1. 콘솔 MCP 등록하기

터미널에서 아래 명령어를 실행해 주세요.

```bash
claude mcp add --transport http apps-in-toss-console \
  https://mcp.toss.im/adapters/apps-in-toss-console/mcp \
  --client-id mcp-gateway
```

***

## 2. 인증하기

Claude에서 콘솔 MCP를 사용하려면 Toss SSO와 비즈 로그인을 통해 인증해야 해요.

1. 새 터미널에서 `claude`를 실행해요.
2. Claude에서 `/mcp`를 입력해 MCP 목록으로 이동해요.
3. `apps-in-toss-console`을 선택해요.
4. `Authenticate`를 눌러 Toss SSO와 비즈 로그인을 완료해요.
5. 상태가 `Connected`인지 확인해요.

***

## 3. 사용할 수 있는 콘솔 작업

AI에게 말로 요청하면 아래 콘솔 작업을 실행할 수 있어요.

#### 워크스페이스와 미니앱

| 도구 이름                       | 설명                                         |
| ------------------------------- | -------------------------------------------- |
| `workspace_list`                | 내가 속한 워크스페이스 목록을 조회해요.      |
| `workspace_get`                 | 특정 워크스페이스 상세 정보를 조회해요.      |
| `workspace_create`              | 새 워크스페이스를 만들어요.                  |
| `workspace_update`              | 워크스페이스 정보를 수정해요.                |
| `workspace_members_list`        | 워크스페이스 멤버 목록을 조회해요.           |
| `miniapp_list`                  | 워크스페이스 안의 미니앱 목록을 조회해요.    |
| `miniapp_get`                   | 특정 미니앱 상세 정보를 조회해요.            |
| `miniapp_create`                | 새 미니앱을 만들어요.                        |
| `miniapp_get_status`            | 미니앱 검수와 운영 상태를 확인해요.          |
| `miniapp_update_basic_info`     | 미니앱 이름, 설명 같은 기본 정보를 수정해요. |
| `miniapp_update_category`       | 미니앱 카테고리를 변경해요.                  |
| `miniapp_update_icon`           | 미니앱 아이콘 이미지를 교체해요.             |
| `miniapp_update_screenshots`    | 미니앱 스크린샷을 교체해요.                  |
| `miniapp_update_age_rating`     | 미니앱 연령등급을 변경해요.                  |
| `miniapp_update_privacy_policy` | 개인정보처리방침을 업데이트해요.             |

#### 검수

| 도구 이름             | 설명                            |
| --------------------- | ------------------------------- |
| `review_list`         | 검수 요청 목록을 조회해요.      |
| `review_get`          | 검수 요청 상세 정보를 조회해요. |
| `review_submit`       | 검수를 신청해요.                |
| `review_cancel`       | 검수를 취소해요.                |
| `review_get_feedback` | 검수 피드백을 확인해요.         |

#### 번들

| 도구 이름                 | 설명                                |
| ------------------------- | ----------------------------------- |
| `bundle_list`             | 업로드된 번들 목록을 조회해요.      |
| `bundle_get_live_version` | 현재 라이브 배포된 버전을 확인해요. |
| `bundle_upload`           | 새 번들을 업로드해요.               |
| `bundle_submit_review`    | 번들 검수를 신청해요.               |
| `bundle_rollback`         | 이전 버전으로 되돌려요.             |
| `bundle_set_release_note` | 릴리즈 노트를 작성해요.             |

#### 대시보드와 분석

| 도구 이름                  | 설명                                 |
| -------------------------- | ------------------------------------ |
| `dashboard_dau`            | 일간 활성 유저(DAU)를 조회해요.      |
| `dashboard_session`        | 세션 수와 세션 길이 통계를 조회해요. |
| `dashboard_retention`      | 리텐션을 확인해요.                   |
| `dashboard_conversion`     | 전환율 통계를 조회해요.              |
| `dashboard_compare_period` | 기간별 지표를 비교해요.              |
| `dashboard_revenue_iap`    | 인앱 결제 매출 현황을 조회해요.      |
| `dashboard_revenue_iaa`    | 인앱 광고 매출 현황을 조회해요.      |
| `dashboard_export_csv`     | 대시보드 데이터를 CSV로 내보내요.    |

#### 이벤트 로그

| 도구 이름              | 설명                         |
| ---------------------- | ---------------------------- |
| `event_log_list`       | 이벤트 로그 목록을 조회해요. |
| `event_log_search`     | 이벤트 로그를 검색해요.      |
| `event_pageview_stats` | 페이지뷰 통계를 조회해요.    |
| `event_act_type_get`   | 이벤트 타입 정의를 조회해요. |
| `event_act_type_set`   | 이벤트 타입 정의를 설정해요. |

#### 인앱 결제

| 도구 이름                       | 설명                             |
| ------------------------------- | -------------------------------- |
| `iap_product_list`              | 인앱 상품 목록을 조회해요.       |
| `iap_product_get`               | 인앱 상품 상세 정보를 조회해요.  |
| `iap_product_create_inspection` | 새 상품 검수를 신청해요.         |
| `iap_product_update_inspection` | 상품 수정 검수를 신청해요.       |
| `iap_product_change_status`     | 상품 판매를 시작하거나 중지해요. |
| `iap_order_list`                | 결제 주문 내역을 조회해요.       |
| `iap_refund_list`               | 환불 요청 목록을 조회해요.       |
| `iap_revenue`                   | 인앱 결제 매출 통계를 조회해요.  |

#### 인앱 광고

| 도구 이름                           | 설명                                      |
| ----------------------------------- | ----------------------------------------- |
| `iaa_ad_unit_group_list`            | 광고 단위 그룹 목록을 조회해요.           |
| `iaa_ad_unit_group_get`             | 광고 단위 그룹 상세 정보를 조회해요.      |
| `iaa_ad_unit_group_change_status`   | 광고 단위를 켜거나 꺼요.                  |
| `iaa_ad_unit_group_delete`          | 광고 단위를 삭제해요.                     |
| `iaa_mediation_groups`              | 미디에이션 그룹 목록을 조회해요.          |
| `iaa_placement_group_list`          | 플레이스먼트 그룹 목록을 조회해요.        |
| `iaa_placement_group_get`           | 플레이스먼트 그룹 상세 정보를 조회해요.   |
| `iaa_placement_group_create`        | 플레이스먼트 그룹을 만들어요.             |
| `iaa_placement_group_update`        | 플레이스먼트 그룹을 수정해요.             |
| `iaa_dashboard_report`              | 광고 성과 리포트를 조회해요.              |
| `iaa_dashboard_report_v2`           | 광고 성과 리포트 v2를 조회해요.           |
| `iaa_workspace_dashboard_report_v2` | 워크스페이스 전체 광고 리포트를 조회해요. |
| `iaa_settlement_summary`            | 광고 정산 요약을 조회해요.                |
| `iaa_settlement_summary_v2`         | 광고 정산 요약 v2를 조회해요.             |

#### 프로모션

| 도구 이름                  | 설명                              |
| -------------------------- | --------------------------------- |
| `promotion_list`           | 프로모션 목록을 조회해요.         |
| `promotion_get`            | 프로모션 상세 정보를 조회해요.    |
| `promotion_create`         | 새 프로모션을 만들어요.           |
| `promotion_modify`         | 프로모션을 수정해요.              |
| `promotion_change_status`  | 프로모션 상태를 변경해요.         |
| `promotion_money_balance`  | 프로모션 예산 잔액을 확인해요.    |
| `promotion_money_charge`   | 프로모션 예산을 충전해요.         |
| `promotion_money_history`  | 예산 충전과 사용 내역을 조회해요. |
| `promotion_stats`          | 프로모션 성과 통계를 조회해요.    |
| `promotion_review_comment` | 프로모션 검수 코멘트를 확인해요.  |

#### 푸시 알림

| 도구 이름                    | 설명                           |
| ---------------------------- | ------------------------------ |
| `push_history_list`          | 푸시 발송 내역을 조회해요.     |
| `push_stats`                 | 푸시 통계를 확인해요.          |
| `push_template_list`         | 푸시 템플릿 목록을 조회해요.   |
| `push_template_create`       | 푸시 템플릿을 만들어요.        |
| `push_template_update`       | 푸시 템플릿을 수정해요.        |
| `push_target_segment_list`   | 타겟 세그먼트 목록을 조회해요. |
| `push_target_segment_create` | 타겟 세그먼트를 만들어요.      |
| `push_send_scheduled`        | 푸시 예약 발송을 등록해요.     |
| `push_cancel_scheduled`      | 푸시 예약 발송을 취소해요.     |

#### 공지와 기타 설정

| 도구 이름                 | 설명                             |
| ------------------------- | -------------------------------- |
| `notice_list`             | 공지 목록을 조회해요.            |
| `notice_get`              | 공지 상세 정보를 조회해요.       |
| `toss_login_get_config`   | 토스 로그인 설정을 조회해요.     |
| `toss_login_update_terms` | 토스 로그인 약관을 업데이트해요. |
