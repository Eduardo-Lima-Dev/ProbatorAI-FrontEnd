export type QuizAlternative = {
  label: string
  text: string
  explanation: string
  selectedByUser: boolean
  isCorrect: boolean
}

export type QuizQuestion = {
  index: number
  question: string
  alternatives: QuizAlternative[]
}

export type QuizData = {
  capturedAt: string
  source: string
  url: string
  totalQuestions: number
  subject: string
  level: string
  questions: QuizQuestion[]
}

export type UploadedQuiz = {
  id: string
  fileName: string
  data: QuizData
  sourceType: 'upload' | 'public' | 'supabase'
  sourceUrl?: string
}
