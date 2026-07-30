-- UJC 마켓 상품 목록을 코드 상수(UJC_MARKET_CATALOG)에서 DB 테이블로 이전 —
-- 종주T가 화면에서 직접 품목/가격을 수정할 수 있게 하기 위함.
-- brand는 실제 로고 이미지(public/brand/*.png)가 있는 것만 허용한다 —
-- 로고 없는 브랜드를 추가하면 화면이 깨지므로 새 브랜드를 쓰려면 로고
-- 이미지 추가 + 코드 수정이 함께 필요하다.

create table ujc_market_items (
  id bigserial primary key,
  tier integer not null check (tier in (10, 20, 30)),
  brand text not null check (brand in ('GS25', 'GOOGLE_PLAY', 'OLIVE_YOUNG')),
  brand_label text not null,
  price_value integer not null check (price_value > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table ujc_market_items enable row level security;

insert into ujc_market_items (tier, brand, brand_label, price_value, sort_order) values
  (10, 'GS25', 'GS25', 5000, 0),
  (10, 'GOOGLE_PLAY', '구글플레이', 5000, 1),
  (10, 'OLIVE_YOUNG', '올리브영', 5000, 2),
  (20, 'GS25', 'GS25', 15000, 3),
  (20, 'GOOGLE_PLAY', '구글플레이', 15000, 4),
  (20, 'OLIVE_YOUNG', '올리브영', 15000, 5),
  (30, 'GS25', 'GS25', 20000, 6),
  (30, 'GOOGLE_PLAY', '구글플레이', 20000, 7),
  (30, 'OLIVE_YOUNG', '올리브영', 20000, 8);
