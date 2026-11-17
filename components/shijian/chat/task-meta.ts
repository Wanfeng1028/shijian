export type TaskId = 'reading' | 'analysis' | 'explanation' | 'roleplay'

export const TASK_META = {
  reading: {
    label: '史料阅读',
    desc: '按步骤引导提取史料关键信息、联系教材知识、生成巩固题。',
    welcome: '你好，我是史鉴。先把你手头的史料发给我，或者选一个主题，我们先一起观察：你发现了什么？',
    quick: ['这段史料里最值得注意的细节是什么？', '这段史料和课本里的哪一课有联系？', '请帮我提炼这段史料的关键信息'],
  },
  analysis: {
    label: '史料辨析',
    desc: '分析史料来源、作者、立场、价值与局限，给出简洁结论。',
    welcome: '你好，我是史鉴。把需要辨析的史料发给我，我们先看它是谁写的、在什么时候、为什么而写。',
    quick: ['这段史料的作者是谁？立场可能是什么？', '这段史料有什么价值，又有什么局限？', '这段史料可信吗？依据是什么？'],
  },
  explanation: {
    label: '历史解释',
    desc: '按「明确问题-梳理背景-提取证据-分析逻辑-形成解释-迁移训练」结构展开。',
    welcome: '你好，我是史鉴。先告诉我你想解释的历史问题，我们按“明确问题—梳理背景—提取证据—分析逻辑—形成解释—迁移训练”一步步来。',
    quick: ['为什么会发生鸦片战争？', '新航路开辟带来了哪些变化？', '如何评价洋务运动？'],
  },
  roleplay: {
    label: '历史人物对话',
    desc: '选一位历史人物，以第一人称与他对话；内容为按当时局限的推想，非史料原文。',
    welcome: '你好，我是史鉴。先选一位历史人物，再开始沉浸对话。',
    quick: ['你能扮演商鞅和我对话吗？', '历史人物对话是怎么回事？', '我想和秦始皇聊聊郡县制'],
  },
} satisfies Record<TaskId, { label: string; desc: string; welcome: string; quick: string[] }>

export const TASK_ORDER: TaskId[] = ['reading', 'analysis', 'explanation', 'roleplay']

export const GRADE_OPTIONS = ['高一', '高二', '高三'] as const
export const CONTEXT_EMPTY_OPTION = '未设置'
export const PROFILE_EMPTY_OPTION = '请选择'

export const SEMESTER_OPTIONS = ['上学期', '下学期'] as const

export const TEXTBOOK_OPTIONS = [
  '《中外历史纲要（上）》',
  '《中外历史纲要（下）》',
  '选必一《国家制度与社会治理》',
  '选必二《经济与社会生活》',
  '选必三《文化交流与传播》',
] as const
