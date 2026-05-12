// supabase/functions/telegram-bot/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildSystemPrompt } from './boss-prompt.ts'

// 🔐 环境变量（确保在 Supabase Secrets 里已设置）
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

// 🔥 初始化 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🔐 白名单配置
const ALLOWED_USERS = {
  usernames: ['洗白白'],
  userIds: [5176544683],
}

serve(async (req) => {
  // 1. 处理 CORS 预检
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 2. 检查空请求体
  try {
    const bodyText = await req.text()
    if (!bodyText || bodyText.trim() === '') {
      console.log('收到空请求体，返回 OK')
      return new Response('OK', { status: 200 })
    }

    // 3. 解析 JSON
    const update = JSON.parse(bodyText)
    console.log('收到消息:', JSON.stringify(update))

    // 4. 处理 callback query（inline 键盘按钮）
    if (update.callback_query) {
      const cb = update.callback_query
      const cbChatId = cb.message.chat.id
      const cbUserId = cb.from.id.toString()
      const cbUsername = cb.from.username || '用户'
      const cbData = cb.data

      // 白名单验证
      const cbAllowed =
        ALLOWED_USERS.usernames.some(name => name.toLowerCase() === cbUsername.toLowerCase()) ||
        ALLOWED_USERS.userIds.includes(cb.from.id)
      if (!cbAllowed) {
        await answerCallback(cb.id)
        return new Response('OK', { status: 200 })
      }

      // Answer callback to dismiss loading state
      await answerCallback(cb.id)

      if (cbData?.startsWith('select_boss:')) {
        const bossKey = cbData.replace('select_boss:', '')
        await handleBossSelection(cbChatId, cbUserId, bossKey)
        return new Response('OK', { status: 200 })
      }

      return new Response('OK', { status: 200 })
    }

    // 5. 只处理文本消息
    if (!update.message?.text) {
      return new Response('OK', { status: 200 })
    }

    const chatId = update.message.chat.id
    const telegramUserId = update.message.from.id.toString()
    const username = update.message.from.username || '用户'
    const userMessage = update.message.text

    // 6. 白名单验证
    const isAllowed =
      ALLOWED_USERS.usernames.some(name => name.toLowerCase() === username.toLowerCase()) ||
      ALLOWED_USERS.userIds.includes(update.message.from.id)

    if (!isAllowed) {
      await sendMessageToTelegram(chatId, '🔐 此 Bot 正在私有测试中，暂不对外开放。')
      return new Response('OK', { status: 200 })
    }

    // 7. 处理 /start 命令
    if (userMessage === '/start') {
      await sendMessageToTelegram(
        chatId,
        `👋 你好 ${username}！我是你的 AI 老板。

📋 可用功能：
• 使用 👥 换老板 选择不同的老板角色
• 点击下方按钮快速操作
• 直接输入消息和我对话`,
        true
      )
      return new Response('OK', { status: 200 })
    }

    // 8. 处理老板选择
    if (userMessage === '/boss' || userMessage === '👥 换老板') {
      await handleBossList(chatId, telegramUserId)
      return new Response('OK', { status: 200 })
    }

    // 9. 处理快捷按钮命令
    if (userMessage === '📋 查看任务') {
      await handleViewTasks(chatId, telegramUserId)
      return new Response('OK', { status: 200 })
    }

    if (userMessage === '✅ 完成任务') {
      await sendMessageToTelegram(chatId, '请回复你要完成的任务名称，例如："完成任务：写周报"')
      return new Response('OK', { status: 200 })
    }

    if (userMessage === '💬 和老板聊聊') {
      await sendMessageToTelegram(chatId, '💬 直接输入你想说的话，老板会回复你！')
      return new Response('OK', { status: 200 })
    }

    if (userMessage === '📊 查看积分') {
      await sendMessageToTelegram(chatId, '📊 积分功能开发中，敬请期待！')
      return new Response('OK', { status: 200 })
    }

    // 10. 处理完成任务（格式："完成任务：xxx"）
    if (userMessage.startsWith('完成任务：')) {
      const taskContent = userMessage.replace('完成任务：', '').trim()
      await handleCompleteTask(chatId, telegramUserId, taskContent)
      return new Response('OK', { status: 200 })
    }

    // 11. 默认：调用 AI 老板
    const bossReply = await askBoss(telegramUserId, userMessage)
    await sendMessageToTelegram(chatId, bossReply)

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('❌ Telegram Bot 错误:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

// 📋 查看任务
async function handleViewTasks(chatId: number, telegramUserId: string) {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', telegramUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error

    if (!tasks || tasks.length === 0) {
      await sendMessageToTelegram(chatId, '📋 当前没有待办任务，休息一下吧！')
      return
    }

    let taskList = '📋 你的待办任务：\n\n'
    tasks.forEach((task, idx) => {
      taskList += `${idx + 1}. ${task.content}\n`
    })
    taskList += '\n完成任务请回复："完成任务：任务名称"'

    await sendMessageToTelegram(chatId, taskList)
  } catch (error) {
    console.error('查看任务失败:', error)
    await sendMessageToTelegram(chatId, '❌ 获取任务失败，请稍后再试')
  }
}

// ✅ 完成任务
async function handleCompleteTask(chatId: number, telegramUserId: string, taskContent: string) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('user_id', telegramUserId)
      .eq('content', taskContent)
      .eq('status', 'pending')
      .select()

    if (error) throw error

    if (data && data.length > 0) {
      await sendMessageToTelegram(chatId, `✅ 已完成任务：「${taskContent}」\n\n继续加油！`)
    } else {
      await sendMessageToTelegram(chatId, `❌ 未找到任务：「${taskContent}」\n\n请检查任务名称是否正确，或使用「📋 查看任务」查看当前任务列表。`)
    }
  } catch (error) {
    console.error('完成任务失败:', error)
    await sendMessageToTelegram(chatId, '❌ 操作失败，请稍后再试')
  }
}

// 👥 老板列表 — 显示所有可选老板
async function handleBossList(chatId: number, userId: string) {
  try {
    const { data: bosses } = await supabase
      .from('bosses')
      .select('key, name, title, avatar, industry, catchphrase')
      .eq('is_active', true)
      .order('sort_order')

    if (!bosses || bosses.length === 0) {
      await sendMessageToTelegram(chatId, '暂无可用老板。')
      return
    }

    const { data: currentConv } = await supabase
      .from('telegram_conversations')
      .select('boss_key')
      .eq('telegram_user_id', userId)
      .maybeSingle()
    const currentKey = currentConv?.boss_key

    let msg = '👥 选择你的老板：\n\n'
    bosses.forEach((b: any) => {
      const check = b.key === currentKey ? ' ✅ 当前' : ''
      msg += `${b.avatar} **${b.name}**（${b.title}）— ${b.industry}${check}\n`
      if (b.catchphrase) msg += `   💬 "${b.catchphrase}"\n`
      msg += '\n'
    })

    const inlineKeyboard = bosses.map((b: any) => ([
      { text: `${b.avatar} ${b.name}`, callback_data: `select_boss:${b.key}` }
    ]))

    await sendMessageWithInlineKeyboard(chatId, msg, inlineKeyboard)
  } catch (error) {
    console.error('获取老板列表失败:', error)
    await sendMessageToTelegram(chatId, '❌ 获取老板列表失败，请稍后再试')
  }
}

// ✅ 老板选择 — 切换用户当前老板
async function handleBossSelection(chatId: number, userId: string, bossKey: string) {
  try {
    const { data: boss } = await supabase
      .from('bosses')
      .select('*')
      .eq('key', bossKey)
      .eq('is_active', true)
      .single()

    if (!boss) {
      await sendMessageToTelegram(chatId, '❌ 未找到该老板。')
      return
    }

    const { data: existing } = await supabase
      .from('telegram_conversations')
      .select('id')
      .eq('telegram_user_id', userId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('telegram_conversations')
        .update({ boss_key: bossKey, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('telegram_conversations')
        .insert({
          telegram_user_id: userId,
          boss_key: bossKey,
          messages: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
    }

    const greeting = boss.greeting_template
      .replace('{name}', boss.name)
      .replace('{title}', boss.title)
      .replace('{catchphrase}', boss.catchphrase)

    await sendMessageToTelegram(chatId,
      `✅ 已切换为 **${boss.name}**（${boss.title}）\n\n${greeting}`,
      true
    )
  } catch (error) {
    console.error('切换老板失败:', error)
    await sendMessageToTelegram(chatId, '❌ 切换失败，请稍后再试')
  }
}

// 🤖 调用 DeepSeek AI（带上下文记忆 + 动态老板角色）
async function askBoss(telegramUserId: string, userMessage: string): Promise<string> {
  try {
    console.log(`🤖 调用 DeepSeek for user ${telegramUserId}: "${userMessage}"`)

    // 1. 读取用户对话记录和 boss_key
    const { data: convData } = await supabase
      .from('telegram_conversations')
      .select('boss_key, messages')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()

    const bossKey = convData?.boss_key || 'zhang'
    const historyMessages = convData?.messages || []

    // 2. 获取老板档案
    const { data: bossData } = await supabase
      .from('bosses')
      .select('*')
      .eq('key', bossKey)
      .single()

    if (!bossData) {
      throw new Error(`Boss not found: ${bossKey}`)
    }

    // 3. 用模板引擎生成系统提示词
    const systemPrompt = buildSystemPrompt(bossData)

    // 4. 构造消息历史
    const messagesForAI = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      { role: 'user', content: userMessage }
    ]

    // 5. 调用 DeepSeek
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messagesForAI,
        max_tokens: Math.max(bossData.max_reply_chars, 200),
        temperature: bossData.temperature || 0.7
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeepSeek API ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const aiReply = data.choices?.[0]?.message?.content || '老板正在思考...'

    // 6. 保存对话
    await saveConversation(telegramUserId, userMessage, aiReply)

    console.log(`🤖 AI 回复: "${aiReply}"`)
    return aiReply

  } catch (error) {
    console.error('❌ AI 调用失败:', error)
    // 临时：返回错误详情方便调试
    const errMsg = error instanceof Error ? error.message : String(error)
    return `🤖 老板网络繁忙，稍后回复你。\n\n[调试] ${errMsg}`
  }
}

// 💾 保存对话到 Supabase
async function saveConversation(telegramUserId: string, userText: string, bossText: string) {
  try {
    const now = new Date().toISOString()
    const newMessages = [
      { role: 'user', text: userText, timestamp: now },
      { role: 'boss', text: bossText, timestamp: now }
    ]

    const { data: existing } = await supabase
      .from('telegram_conversations')
      .select('id, messages')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()

    if (existing?.messages) {
      const updatedMessages = [...existing.messages, ...newMessages].slice(-20)

      await supabase
        .from('telegram_conversations')
        .update({
          messages: updatedMessages,
          updated_at: now
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('telegram_conversations')
        .insert({
          telegram_user_id: telegramUserId,
          messages: newMessages,
          created_at: now,
          updated_at: now
        })
    }

    console.log('💾 对话已保存')
  } catch (error) {
    console.error('❌ 保存对话失败:', error)
  }
}

// 📨 发送消息到 Telegram
async function sendMessageToTelegram(chatId: number, text: string, withButtons: boolean = false) {
  const payload: any = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  }

  if (withButtons) {
    payload.reply_markup = {
      keyboard: [
        ['📋 查看任务', '✅ 完成任务'],
        ['💬 和老板聊聊', '👥 换老板']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  } else {
    payload.reply_markup = {
      remove_keyboard: true
    }
  }

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

// 🔔 应答 callback query — 解除 Telegram 按钮 loading 状态
async function answerCallback(callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || ''
    })
  })
}

// ⌨️ 发送带 inline keyboard 的消息
async function sendMessageWithInlineKeyboard(chatId: number, text: string, inlineKeyboard: any[][]) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    })
  })
}
