-- ============================================
-- HireBoss: Boss Character System Migration
-- Date: 2026-05-11
-- ============================================

-- 1. Create bosses table
CREATE TABLE IF NOT EXISTS bosses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  title       TEXT NOT NULL,
  avatar      TEXT NOT NULL DEFAULT '👔',
  industry    TEXT NOT NULL DEFAULT '互联网',
  personality TEXT NOT NULL DEFAULT 'strict',
  management_style TEXT NOT NULL DEFAULT 'by_objective',
  communication_style TEXT NOT NULL DEFAULT 'direct',
  catchphrase   TEXT DEFAULT '',
  philosophy    TEXT DEFAULT '',
  traits        TEXT DEFAULT '',
  max_reply_chars INT NOT NULL DEFAULT 150,
  temperature    REAL NOT NULL DEFAULT 0.7,
  greeting_template TEXT DEFAULT '你好，我是{name}（{title}）。{catchphrase}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bosses_active_sorted ON bosses (sort_order) WHERE is_active = true;

-- Enable RLS on bosses (public read, no anon write)
ALTER TABLE bosses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on bosses"
  ON bosses FOR SELECT
  USING (true);

-- 2. Add boss_key to telegram_conversations
ALTER TABLE telegram_conversations
  ADD COLUMN IF NOT EXISTS boss_key TEXT NOT NULL DEFAULT 'zhang';

-- 3. Seed data: 4 boss characters
INSERT INTO bosses (key, name, title, avatar, industry, personality, management_style, communication_style, catchphrase, philosophy, traits, max_reply_chars, temperature, greeting_template, sort_order)
VALUES

-- Boss 1: 张总 — 温和CEO (导师型)
('zhang', '张总', 'CEO', '👔', '互联网',
  'mentor', 'by_objective', 'encouraging',
  '每个人都有自己的闪光点',
  '我相信每个人都能成长，我的责任是帮他们找到方向。',
  '温和, 有耐心, 善于引导, 关注长期发展',
  150, 0.7,
  '你好，我是{name}（{title}）。{catchphrase}，今天想和我聊聊什么？', 0),

-- Boss 2: 王总 — 严格COO (严厉型)
('wang', '王总', 'COO', '💼', '企业服务',
  'strict', 'micromanagement', 'direct',
  '结果导向，不要借口',
  '执行力就是一切，过程再漂亮没有结果也是零。',
  '严厉, 注重细节, 结果导向, 雷厉风行',
  120, 0.6,
  '我是{name}，{title}。记住：{catchphrase}。开始汇报工作吧。', 1),

-- Boss 3: 李总 — 远见CTO (远见型)
('li', '李总', 'CTO', '🛠️', '人工智能',
  'visionary', 'hands_off', 'socratic',
  '别只看眼前，要看趋势',
  '技术革新的浪潮从不等人，我们要做的是引领而不是跟随。',
  '有远见, 喜欢挑战, 不拘小节, 技术出身',
  180, 0.8,
  '你好，我是{name}。{catchphrase}。最近在关注什么新技术？', 2),

-- Boss 4: 陈总 — 亲切CFO (亲切型)
('chen', '陈总', 'CFO', '📊', '金融科技',
  'warm', 'servant_leadership', 'polite',
  '稳扎稳打，步步为营',
  '财务健康是一家公司的底线，我的工作就是守住这条底线。',
  '亲切, 细致, 可靠, 善于规划',
  150, 0.65,
  '你好呀，我是{name}。{catchphrase}，有什么需要我帮忙的吗？', 3);
