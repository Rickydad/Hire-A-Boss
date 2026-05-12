import { useState, useEffect, useRef } from 'react';
import { Send, Briefcase } from 'lucide-react';


import { createClient } from '@supabase/supabase-js';

// 🔥 Supabase 配置（替换成你的）
const supabase = createClient(
  'https://wgymswtcffgjrgpbysmd.supabase.co',  // ← 替换 Project URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndneW1zd3RjZmZnanJncGJ5c21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTA2MzksImV4cCI6MjA5MDM2NjYzOX0.IqxuBFr-zJJTVo4Wu1sh1PoKqAkag6gvv-LmZH4uMGQ'  // ← 替换 anon public key
);

// 生成用户 ID
const getUserId = () => {
  // 🔧 临时固定，用于测试多设备同步
  return 'user-123';
};

const USER_ID = getUserId();

// 🔥 API 配置（替换成你的真实信息）
//const API_CONFIG = {
//  url: 'https://api.deepseek.com/chat/completions',
//  apiKey: 'sk-f6fe7c90b0e24ea283baa742d46db4dc', // ← 替换成你的 API Key
//  model: 'deepseek-chat',
//  
//};

interface Message {
  id: string;
  role: 'user' | 'boss';
  text: string;
  timestamp: number;
}

interface Boss {
  name: string;
  title: string;
  avatar: string;
  tasks: string[];
  systemPrompt: string; // 新增：老板人设
}

const BOSSES: Record<string, Boss> = {
  zhang: {
    name: '张总',
    title: 'CEO',
    avatar: '👔',
    tasks: ['完成季度报告', '准备融资方案', '优化团队结构'],
    systemPrompt: '你是一个温和的 CEO，善于鼓励员工，关注长期发展和员工成长'
  },
  wang: {
    name: '王总',
    title: 'COO',
    avatar: '💼',
    tasks: ['执行成本优化', '提升运营效率', '建立质量体系'],
    systemPrompt: '你是一个严格的 COO，注重效率和结果，说话简洁直接'
  }
};

// 预设回复（AI 接入前的临时方案）
const BOSS_REPLIES = [
  '收到，我会安排',
  '很好，继续加油',
  '做得不错，保持进度',
  '明白了，稍后讨论细节',
  '好的，按计划执行'
];

function App() {
  const [currentBoss, setCurrentBoss] = useState<'zhang' | 'wang'>('wang');
  
  // 🔧 修改 1：每个老板独立的对话记录
  const [conversations, setConversations] = useState<Record<string, Message[]>>({
    zhang: [],
    wang: []
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 获取当前老板的对话
  const messages = conversations[currentBoss];

  // 🔧 修改 2：加载时恢复所有老板的对话记录
// 🔁 替换原来的加载逻辑
useEffect(() => {
  loadConversationsFromCloud();
}, []);

const loadConversationsFromCloud = async () => {
  try {
    console.log('📥 正在从云端加载数据...', USER_ID);
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', USER_ID);
    
    if (error) {
      console.error('加载失败:', error);
      throw error;
    }
    
    console.log('📦 云端数据:', data);
    
    if (data && data.length > 0) {
      // 从云端恢复数据
      const conversations: Record<string, Message[]> = {};
      data.forEach(row => {
        conversations[row.boss_key] = row.messages;
      });
      setConversations(conversations);
      console.log('✅ 云端数据加载成功');
    } else {
      // 没有云端数据，初始化默认对话
      console.log('ℹ️ 无云端数据，使用默认对话');
      const defaultConversations: Record<string, Message[]> = {
        zhang: [{
          id: `welcome-zhang-${Date.now()}`,
          role: 'boss',
          text: `你好，我是${BOSSES.zhang.name}。今天的工作如何？`,
          timestamp: Date.now()
        }],
        wang: [{
          id: `welcome-wang-${Date.now()}`,
          role: 'boss',
          text: `你好，我是${BOSSES.wang.name}。今天的工作如何？`,
          timestamp: Date.now()
        }]
      };
      setConversations(defaultConversations);
    }
  } catch (error) {
    console.error('💥 加载云端数据失败:', error);
    // 失败时尝试从本地恢复
    const saved = localStorage.getItem('hireBossConversations');
    if (saved) {
      setConversations(JSON.parse(saved));
      console.log('ℹ️ 已从本地恢复数据');
    }
  }
};


  // 🔧 修改 3：保存所有老板的对话记录
// 🔁 替换原来的保存逻辑
useEffect(() => {
  saveConversationsToCloud();
  // 本地也保存一份（离线可用）
  localStorage.setItem('hireBossConversations', JSON.stringify(conversations));
}, [conversations]);

const saveConversationsToCloud = async () => {
  try {
    console.log('📤 正在保存数据到云端...');
    
    for (const [bossKey, messages] of Object.entries(conversations)) {
      const { data, error } = await supabase
        .from('conversations')
        .upsert({
          user_id: USER_ID,
          boss_key: bossKey,
          messages: messages,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,boss_key'
        });
      
      if (error) {
        console.error(`❌ 保存 ${bossKey} 失败:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        console.log(`✅ ${bossKey} 保存成功:`, data);
      }
    }
    
  } catch (error) {
    console.error('💥 保存云端数据失败:', error);
  }
};

  // 保存当前老板选择
  useEffect(() => {
    localStorage.setItem('hireBossCurrentBoss', currentBoss);
  }, [currentBoss]);

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 🔧 修改 4：添加欢迎消息的函数
  const addWelcomeMessage = (bossKey: string) => {
    const boss = BOSSES[bossKey];
    const welcomeMessage: Message = {
      id: `welcome-${bossKey}-${Date.now()}`,
      role: 'boss',
      text: `你好，我是${boss.name}。今天的工作如何？`,
      timestamp: Date.now()
    };
    
    setConversations(prev => ({
      ...prev,
      [bossKey]: [welcomeMessage]
    }));
  };

  // 🔧 修改 5：切换老板时，显示对应老板的对话
  const switchBoss = (boss: 'zhang' | 'wang') => {
    setCurrentBoss(boss);
    
    // 如果新老板没有对话，添加欢迎语
    if (!conversations[boss] || conversations[boss].length === 0) {
      setTimeout(() => addWelcomeMessage(boss), 100);
    }
  };

  // 🔧 修改 6：发送消息只更新当前老板的对话
  const sendMessage = async () => {
  if (!input.trim()) return;

  const userMessage: Message = {
    id: `user-${Date.now()}`,
    role: 'user',
    text: input,
    timestamp: Date.now()
  };

  // 添加用户消息到对话
  setConversations(prev => ({
    ...prev,
    [currentBoss]: [...(prev[currentBoss] || []), userMessage]
  }));
  
  setInput('');
  setIsLoading(true);

  try {
    const currentConversation = conversations[currentBoss] || [];
    const boss = BOSSES[currentBoss];
    
    // 🔥 新增：限制历史消息数量（最多保留最近20条，约10轮对话）
    const MAX_HISTORY_MESSAGES = 20;

// 只取最近的消息
const recentMessages = currentConversation.slice(-MAX_HISTORY_MESSAGES).map(msg => ({
  role: msg.role === 'user' ? 'user' : 'assistant',
  content: msg.text
}));

const messagesForAPI = [
  { 
    role: 'system', 
    content: `你是${boss.name}（${boss.title}）。${boss.systemPrompt}。请用简洁的中文回复，每次回复不超过 50 字。`
  },
  ...recentMessages,  // 🔥 改用截断后的历史
  { role: 'user', content: input }
];


 const response = await fetch(`${supabase.supabaseUrl}/functions/v1/call-ai`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabase.supabaseKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: messagesForAPI,
    boss: boss
  })
})

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    const aiReply = data.reply;;

    // 添加 AI 回复
    const bossReply: Message = {
      id: `boss-${Date.now()}`,
      role: 'boss',
      text: aiReply,
      timestamp: Date.now()
    };
    
    setConversations(prev => ({
      ...prev,
      [currentBoss]: [...(prev[currentBoss] || []), bossReply]
    }));
    
  } catch (error) {
    console.error('AI 调用失败:', error);
    
    // 失败时用预设回复
    const bossReply: Message = {
      id: `boss-${Date.now()}`,
      role: 'boss',
      text: '抱歉，我现在有点忙，稍后回复你。',
      timestamp: Date.now()
    };
    
    setConversations(prev => ({
      ...prev,
      [currentBoss]: [...(prev[currentBoss] || []), bossReply]
    }));
  } finally {
    setIsLoading(false);
  }
};

  const boss = BOSSES[currentBoss];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <header className="bg-gray-800/80 backdrop-blur border-b border-gray-700 px-4 py-3 flex-shrink-0">
        <h1 className="text-xl font-bold text-center mb-3 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          Hire A Boss
        </h1>
        <div className="flex gap-2 justify-center">
          {Object.entries(BOSSES).map(([key, b]) => (
            <button
              key={key}
              onClick={() => switchBoss(key as 'zhang' | 'wang')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                currentBoss === key
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {b.avatar} {b.name}
            </button>
          ))}
        </div>
      </header>

      <div className="bg-gray-800/40 border-b border-gray-700 px-4 py-3 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 mb-2">
          <Briefcase className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-300">今日任务</span>
        </div>
        <div className="flex gap-2">
          {boss.tasks.map((task, idx) => (
            <div
              key={idx}
              className="flex-shrink-0 bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm whitespace-nowrap hover:border-amber-500/50 transition-colors"
            >
              {task}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>开始对话</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'boss' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-lg">
                {boss.avatar}
              </div>
            )}
            <div
              className={`max-w-xs px-4 py-2 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-br-none'
                  : 'bg-gray-700 text-gray-100 rounded-bl-none'
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              <span className="text-xs opacity-60 mt-1 block">
                {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-lg">
                👤
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-lg">
              {boss.avatar}
            </div>
            <div className="bg-gray-700 text-gray-100 px-4 py-2 rounded-2xl rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse animation-delay-200"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse animation-delay-400"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-gray-800/80 backdrop-blur border-t border-gray-700 px-4 py-3 flex-shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="输入消息..."
            className="flex-1 bg-gray-700/50 border border-gray-600 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white p-2 rounded-full transition-all transform hover:scale-105 disabled:transform-none flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;