import { useState, useEffect, useRef, useEffect as useLayoutEffect } from 'react';
import { Send, Briefcase } from 'lucide-react';

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
}

const BOSSES: Record<string, Boss> = {
  zhang: {
    name: '张总',
    title: 'CEO',
    avatar: '👔',
    tasks: ['完成季度报告', '准备融资方案', '优化团队结构']
  },
  wang: {
    name: '王总',
    title: 'COO',
    avatar: '💼',
    tasks: ['执行成本优化', '提升运营效率', '建立质量体系']
  }
};

const BOSS_REPLIES = [
  '收到，我会安排',
  '很好，继续加油',
  '做得不错，保持进度',
  '明白了，稍后讨论细节',
  '好的，按计划执行'
];

function App() {
  const [currentBoss, setCurrentBoss] = useState<'zhang' | 'wang'>('zhang');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hireBossChat');
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
      setMessages([
        {
          id: '1',
          role: 'boss',
          text: `你好，我是${BOSSES[currentBoss].name}。今天的工作如何？`,
          timestamp: Date.now() - 5000
        }
      ]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('hireBossChat', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const switchBoss = (boss: 'zhang' | 'wang') => {
    setCurrentBoss(boss);
    localStorage.setItem('hireBossCurrentBoss', boss);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    setTimeout(() => {
      const bossReply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'boss',
        text: BOSS_REPLIES[Math.floor(Math.random() * BOSS_REPLIES.length)],
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, bossReply]);
      setIsLoading(false);
    }, 800);
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
