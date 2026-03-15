-- ===== Supabase 테이블 생성 SQL =====
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 식물 테이블
create table plants (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz default now()
);

-- 2. 기록 테이블
create table records (
  id bigint generated always as identity primary key,
  plant_id bigint references plants(id) on delete cascade not null,
  photo_url text not null,
  recorded_at timestamptz default now()
);

-- 3. RLS(Row Level Security) - 퍼블릭 접근 허용 (데모용)
alter table plants enable row level security;
alter table records enable row level security;

create policy "Allow all on plants" on plants for all using (true) with check (true);
create policy "Allow all on records" on records for all using (true) with check (true);

-- 4. Storage 버킷 생성 (Supabase Dashboard > Storage에서 생성하거나 아래 SQL 실행)
insert into storage.buckets (id, name, public) values ('plant-photos', 'plant-photos', true);

-- Storage 정책: 누구나 업로드/읽기 가능 (데모용)
create policy "Allow public upload" on storage.objects for insert with check (bucket_id = 'plant-photos');
create policy "Allow public read" on storage.objects for select using (bucket_id = 'plant-photos');
