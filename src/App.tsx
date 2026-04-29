import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import QuestionCard from './components/QuestionCard'
import QuizList from './components/QuizList'
import {
  getCurrentSession,
  loadQuizzesFromSupabase,
  onAuthStateChanged,
  signInWithEmail,
  signOutUser,
  signUpWithEmailAndInviteToken,
  uploadQuizzesToSupabase,
} from './lib/quiz-loader'
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
  const [session, setSession] = useState<Session | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

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
    const setupAuth = async () => {
      try {
        const initialSession = await getCurrentSession()
        setSession(initialSession)
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Erro ao inicializar autenticação.')
      } finally {
        setAuthChecked(true)
      }
    }

    void setupAuth()

    const subscription = onAuthStateChanged((_event, activeSession) => {
      setSession(activeSession)
      if (!activeSession) {
        setUploadedQuizzes([])
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return

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
  }, [session])

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError(null)

    try {
      if (authMode === 'login') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmailAndInviteToken(email, password, inviteToken)
        setAuthMode('login')
        setAuthError('Cadastro realizado. Faça login para continuar.')
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Falha na autenticação.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOutUser()
      resetViewer()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao sair da conta.')
    }
  }

  if (!authChecked) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center bg-slate-950 px-4 py-6 text-slate-100">
        <p className="text-sm text-slate-300">Carregando autenticação...</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center bg-slate-950 px-4 py-6 text-slate-100">
        <section className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h1 className="text-2xl font-semibold">Acesso às Questões</h1>
          <p className="mt-2 text-sm text-slate-300">
            Faça login para ver os quizzes. Novos cadastros exigem token de convite único.
          </p>
          <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Seu email"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            {authMode === 'register' ? (
              <input
                type="text"
                required
                value={inviteToken}
                onChange={(event) => setInviteToken(event.target.value)}
                placeholder="Token de convite"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            ) : null}
            {authError ? <p className="text-sm text-red-300">{authError}</p> : null}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {authLoading ? 'Processando...' : authMode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))
              setAuthError(null)
            }}
            className="mt-3 text-sm text-indigo-300 hover:text-indigo-200"
          >
            {authMode === 'login'
              ? 'Não tem conta? Cadastre-se com token de convite'
              : 'Já tem conta? Fazer login'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Banco de Questões</h1>
            <p className="mt-1 text-xs text-slate-400">Conectado como {session.user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
          >
            Sair
          </button>
        </div>
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
