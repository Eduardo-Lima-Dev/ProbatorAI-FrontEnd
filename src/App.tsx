import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import QuestionCard from './components/QuestionCard'
import QuizList from './components/QuizList'
import { loadQuizzesFromSupabase, uploadQuizzesToSupabase } from './lib/quiz-loader'
import type { QuizQuestion, UploadedQuiz } from './types/quiz'

const ITEMS_PER_PAGE = 10
const IS_PRODUCTION = import.meta.env.PROD
const formatQuizTitle = (subject: string) => {
  const normalized = subject.trim().toLowerCase()
  const subjectLabel = normalized === 'ciencias' ? 'Ciências' : subject
  return `Quiz ${subjectLabel.charAt(0).toUpperCase()}${subjectLabel.slice(1)}`
}

function App() {
  const [uploadedQuizzes, setUploadedQuizzes] = useState<UploadedQuiz[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showAllQuestions, setShowAllQuestions] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const selectedQuiz = useMemo(
    () => uploadedQuizzes.find((quiz) => quiz.id === selectedQuizId) ?? null,
    [uploadedQuizzes, selectedQuizId],
  )

  const totalPages = Math.max(1, Math.ceil(uploadedQuizzes.length / ITEMS_PER_PAGE))
  const paginatedQuizzes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return uploadedQuizzes.slice(start, start + ITEMS_PER_PAGE)
  }, [currentPage, uploadedQuizzes])

  const handleFilesUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList).filter((file) => file.name.endsWith('.json'))
    if (files.length === 0) {
      setErrorMessage('Selecione arquivos .json válidos.')
      return
    }

    setIsLoading(true)
    try {
      await uploadQuizzesToSupabase(files)
      const quizzes = await loadQuizzesFromSupabase()
      setUploadedQuizzes(quizzes)
      resetViewer()
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao enviar arquivos para o Supabase.')
    } finally {
      setIsLoading(false)
    }
  }

  const resetViewer = () => {
    setCurrentPage(1)
    setSelectedQuizId(null)
    setCurrentQuestionIndex(0)
    setShowAllQuestions(false)
  }

  const openQuiz = (quizId: string) => {
    setSelectedQuizId(quizId)
    setCurrentQuestionIndex(0)
    setShowAllQuestions(false)
  }

  const closeQuiz = () => {
    setSelectedQuizId(null)
    setCurrentQuestionIndex(0)
    setShowAllQuestions(false)
  }

  const changeQuestion = (direction: 'prev' | 'next') => {
    if (!selectedQuiz) return
    const maxIndex = selectedQuiz.data.questions.length - 1
    setCurrentQuestionIndex((prev) => {
      if (direction === 'prev') return Math.max(0, prev - 1)
      return Math.min(maxIndex, prev + 1)
    })
  }

  const currentQuestion: QuizQuestion | null = selectedQuiz
    ? selectedQuiz.data.questions[currentQuestionIndex] ?? null
    : null

  useEffect(() => {
    const autoLoadSupabase = async () => {
      try {
        const quizzes = await loadQuizzesFromSupabase()
        if (quizzes.length > 0) {
          setUploadedQuizzes(quizzes)
        }
      } catch {
        // Mantém silencioso na inicialização caso variáveis ainda não estejam configuradas.
      }
    }

    void autoLoadSupabase()
  }, [])

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Banco de Questões</h1>
        <p className="mt-2 text-sm text-slate-300">
          {IS_PRODUCTION
            ? 'Carregue os quizzes diretamente do Supabase Storage.'
            : 'Use upload local, carregamento da pasta public ou Supabase Storage.'}
        </p>
        <input
          type="file"
          accept=".json,application/json"
          multiple
          onChange={handleFilesUpload}
          className="mt-4 block w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-400"
        />
        <p className="mt-2 text-xs text-slate-400">Os arquivos selecionados serão enviados para o bucket do Supabase (upsert).</p>
        {errorMessage ? (
          <p className="mt-3 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorMessage}
          </p>
        ) : null}
        {isLoading ? <p className="mt-3 text-sm text-slate-400">Carregando quizzes...</p> : null}
      </div>

      {!selectedQuiz ? (
        <QuizList
          quizzes={paginatedQuizzes}
          currentPage={currentPage}
          totalPages={totalPages}
          onChangePage={setCurrentPage}
          onOpenQuiz={openQuiz}
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                type="button"
                onClick={closeQuiz}
                className="mb-3 inline-flex items-center rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
              >
                Voltar para lista
              </button>
              <h2 className="text-lg font-semibold text-slate-100 sm:text-xl">{formatQuizTitle(selectedQuiz.data.subject)}</h2>
              <p className="text-sm text-slate-300">
                {selectedQuiz.data.subject} · {selectedQuiz.data.level} · {selectedQuiz.data.totalQuestions} questões
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAllQuestions((prev) => !prev)}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
            >
              {showAllQuestions ? 'Ver questão atual' : 'Ver questões completas'}
            </button>
          </div>

          {showAllQuestions ? (
            <div className="space-y-4">
              {selectedQuiz.data.questions.map((question) => (
                <QuestionCard key={question.index} question={question} total={selectedQuiz.data.questions.length} />
              ))}
            </div>
          ) : currentQuestion ? (
            <>
              <QuestionCard question={currentQuestion} total={selectedQuiz.data.questions.length} />
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
                <button
                  type="button"
                  onClick={() => changeQuestion('prev')}
                  disabled={currentQuestionIndex === 0}
                  className="rounded-md border border-slate-700 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <p className="text-sm text-slate-300">
                  {currentQuestionIndex + 1} / {selectedQuiz.data.questions.length}
                </p>
                <button
                  type="button"
                  onClick={() => changeQuestion('next')}
                  disabled={currentQuestionIndex === selectedQuiz.data.questions.length - 1}
                  className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </>
          ) : null}
        </section>
      )}
    </main>
  )
}

export default App
