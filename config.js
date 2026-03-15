// ===== Supabase 설정 =====
// 아래 값을 본인의 Supabase 프로젝트 정보로 교체하세요.
// Supabase Dashboard > Settings > API 에서 확인할 수 있습니다.

const SUPABASE_URL = 'https://agxoheqnwvffuejxbjzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneG9oZXFud2Z2ZnVlanhianpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTU3NjgsImV4cCI6MjA4OTEzMTc2OH0.7H2Fw6CEuLJPE-mzOxSAC64B9uKTUkqE9jfkrmjYTUE';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
