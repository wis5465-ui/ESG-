// ===== Supabase 설정 =====
// 아래 값을 본인의 Supabase 프로젝트 정보로 교체하세요.
// Supabase Dashboard > Settings > API 에서 확인할 수 있습니다.

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
