-- 할 일 앱에서 쓰는 표(테이블)를 만드는 SQL이에요.
-- 수퍼베이스 대시보드 → SQL Editor 에 이 내용을 통째로 붙여넣고 Run 을 누르세요.

create table if not exists public.todos (
  id         bigint primary key,           -- 할 일 번호 (앱에서 Date.now()로 만들어요)
  text       text not null,                -- 할 일 내용
  done       boolean not null default false, -- 완료했는지
  due        date,                         -- 마감 날짜 (없으면 비어 있음)
  hidden     boolean not null default false, -- 완료한 일을 '지우기' 했는지
  author     text,                         -- 작성자 이름 (안 적으면 비어 있음)
  created_at timestamptz not null default now()
);

-- 예전에 author 칸 없이 만든 표에도 칸을 추가해요
alter table public.todos add column if not exists author text;

-- 진행률 (0~100%). 100이면 완료예요
alter table public.todos
  add column if not exists progress smallint not null default 0
  check (progress between 0 and 100);

-- 보안 규칙(RLS)을 켜고, 로그인 없이도 누구나 읽고/추가하고/고치고/지울 수 있게 허용해요.
-- (앱 주소를 아는 사람은 누구나 목록을 바꿀 수 있다는 뜻이에요.)
alter table public.todos enable row level security;

drop policy if exists "누구나 할 일 사용 가능" on public.todos;
create policy "누구나 할 일 사용 가능" on public.todos
  for all to anon, authenticated
  using (true) with check (true);

grant select, insert, update, delete on public.todos to anon, authenticated;
