import { createClient } from '@supabase/supabase-js'
import type { QuizData, UploadedQuiz } from '../types/quiz'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SUPABASE_BUCKET = import.meta.env.VITE_SUPABASE_BUCKET ?? 'quizzes-json'

const isQuizData = (value: unknown): value is QuizData => {
  if (!value || typeof value !== 'object') return false
  const quiz = value as Partial<QuizData>
  return Array.isArray(quiz.questions)
}

const toUploadedQuiz = (quizData: QuizData, fileName: string, sourceType: UploadedQuiz['sourceType'], sourceUrl?: string): UploadedQuiz => ({
  id: `${sourceType}-${fileName}-${crypto.randomUUID()}`,
  fileName,
  data: quizData,
  sourceType,
  sourceUrl,
})

const parseRawQuiz = (rawData: unknown, fileName: string, sourceType: UploadedQuiz['sourceType'], sourceUrl?: string): UploadedQuiz => {
  if (!isQuizData(rawData)) {
    throw new Error(`Arquivo "${fileName}" não está no formato esperado.`)
  }
  return toUploadedQuiz(rawData, fileName, sourceType, sourceUrl)
}

export const parseQuizFile = async (file: File): Promise<UploadedQuiz> => {
  const rawText = await file.text()
  const rawData: unknown = JSON.parse(rawText)
  return parseRawQuiz(rawData, file.name, 'upload')
}

export const loadQuizzesFromPublic = async (): Promise<UploadedQuiz[]> => {
  const manifestResponse = await fetch('/quizzes/index.json')
  if (!manifestResponse.ok) {
    throw new Error('Não foi possível ler /public/quizzes/index.json.')
  }

  const fileNames: unknown = await manifestResponse.json()
  if (!Array.isArray(fileNames)) {
    throw new Error('O arquivo /public/quizzes/index.json deve conter uma lista de arquivos JSON.')
  }

  const validNames = fileNames.filter((name): name is string => typeof name === 'string' && name.endsWith('.json'))
  const quizzes = await Promise.all(
    validNames.map(async (fileName) => {
      const path = `/quizzes/${fileName}`
      const response = await fetch(path)
      if (!response.ok) {
        throw new Error(`Falha ao carregar ${path}.`)
      }
      const rawData: unknown = await response.json()
      return parseRawQuiz(rawData, fileName, 'public', path)
    }),
  )

  return quizzes
}

export const loadQuizzesFromSupabase = async (): Promise<UploadedQuiz[]> => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente.')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: files, error } = await supabase.storage.from(SUPABASE_BUCKET).list('', {
    limit: 100,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) throw new Error(`Erro ao listar arquivos do bucket "${SUPABASE_BUCKET}": ${error.message}`)

  const jsonFiles = (files ?? []).filter((entry) => entry.name.endsWith('.json'))
  const quizzes = await Promise.all(
    jsonFiles.map(async (entry) => {
      const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(entry.name)
      const response = await fetch(data.publicUrl)
      if (!response.ok) {
        throw new Error(`Falha ao baixar "${entry.name}" do Supabase.`)
      }
      const rawData: unknown = await response.json()
      return parseRawQuiz(rawData, entry.name, 'supabase', data.publicUrl)
    }),
  )

  return quizzes
}

export const uploadQuizzesToSupabase = async (files: File[]): Promise<void> => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente.')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const uploadResults = await Promise.allSettled(
    files.map(async (file) => {
      if (!file.name.endsWith('.json')) {
        throw new Error(`Arquivo "${file.name}" não é JSON.`)
      }

      // Valida o JSON localmente antes de enviar para o bucket.
      await parseQuizFile(file)

      const { error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(file.name, file, { upsert: true, contentType: 'application/json' })

      if (error) {
        throw new Error(`Falha ao enviar "${file.name}" para o bucket: ${error.message}`)
      }
    }),
  )

  const failures = uploadResults.filter((result) => result.status === 'rejected')
  if (failures.length > 0) {
    const details = failures
      .map((failure) =>
        failure.status === 'rejected'
          ? failure.reason instanceof Error
            ? failure.reason.message
            : 'Erro desconhecido'
          : '',
      )
      .filter(Boolean)
      .join(' ')
    throw new Error(details)
  }
}
