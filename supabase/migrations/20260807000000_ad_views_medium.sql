-- 광고 기록에 매체를 남긴다 (DESIGN.md 6장 관리자)
-- 웹(AdSense)·안드로이드(AdMob)·앱인토스는 재고도 단가도 따로 논다. 매체가 없으면
-- 셋이 한 덩어리로 뭉쳐서, '못 뜸'이 어느 매체의 재고 문제인지 갈라볼 수 없다.
--
-- 함께: 테스트 광고는 이제 적재하지 않는다. 5초 카운트다운 스텁, 구글 공개 테스트
-- 단위, 앱인토스 테스트 광고 그룹, dev 서버가 모두 여기 해당한다. 판단은 앱이 하고
-- (ads.ts) 서버는 매체가 붙은 행만 센다.
-- 여러 번 실행해도 안전하도록 작성

alter table public.ad_views
  add column if not exists medium text
    check (medium in ('adsense', 'admob', 'toss'));

-- 반환 컬럼이 바뀌므로 create or replace로는 안 되고 지웠다 다시 만들어야 한다
drop function if exists public.get_ad_stats(int);

-- 통계 화면용: (매체, 게임, 자리) 한 쌍을 한 줄로. 묶음은 화면에서 한다.
create function public.get_ad_stats(p_days int default 7)
returns table (
  medium text,
  game_slug text,
  placement text,
  viewed bigint,
  dismissed bigint,
  unavailable bigint
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  -- 반환 컬럼과 이름이 겹치면 plpgsql이 어느 쪽인지 몰라 막히므로 별칭을 달아 둔다
  select v.medium as src,
         v.game_slug as slug,
         v.placement as spot,
         count(*) filter (where v.outcome = 'viewed') as n_viewed,
         count(*) filter (where v.outcome = 'dismissed') as n_dismissed,
         count(*) filter (where v.outcome = 'unavailable') as n_unavailable
  from public.ad_views v
  where v.created_at >= now() - make_interval(days => greatest(1, least(365, p_days)))
    -- 매체가 없는 행 = 이 마이그레이션 전에 쌓인 것. 테스트와 실제가 섞여 있고
    -- 갈라낼 단서가 남아 있지 않으므로 세지 않는다 (지우지는 않는다)
    and v.medium is not null
  group by v.medium, v.game_slug, v.placement
  order by count(*) desc, src, slug, spot;
end;
$$;
