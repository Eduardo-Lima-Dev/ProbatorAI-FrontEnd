import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ToastContainer, toast } from 'react-toastify'
import QuestionCard from './components/QuestionCard'
import QuizList from './components/QuizList'
import { formatDisplayText } from './lib/text'
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
const normalizeFilterValue = (value: string) => value.trim().toLocaleLowerCase('pt-BR')
const formatQuizTitle = (subject: string) => {
  return `Quiz ${formatDisplayText(subject)}`
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
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')

  const selectedQuiz = useMemo(
    () => uploadedQuizzes.find((quiz) => quiz.id === selectedQuizId) ?? null,
    [uploadedQuizzes, selectedQuizId],
  )

  const subjectOptions = useMemo(() => {
    return Array.from(new Set(uploadedQuizzes.map((quiz) => normalizeFilterValue(quiz.data.subject)))).sort()
  }, [uploadedQuizzes])

  const levelOptions = useMemo(() => {
    return Array.from(new Set(uploadedQuizzes.map((quiz) => normalizeFilterValue(quiz.data.level)))).sort()
  }, [uploadedQuizzes])

  const filteredQuizzes = useMemo(() => {
    return uploadedQuizzes.filter((quiz) => {
      const quizSubject = normalizeFilterValue(quiz.data.subject)
      const quizLevel = normalizeFilterValue(quiz.data.level)
      const subjectMatches = subjectFilter === 'all' || quizSubject === subjectFilter
      const levelMatches = levelFilter === 'all' || quizLevel === levelFilter
      return subjectMatches && levelMatches
    })
  }, [uploadedQuizzes, subjectFilter, levelFilter])

  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / ITEMS_PER_PAGE))
  const paginatedQuizzes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredQuizzes.slice(start, start + ITEMS_PER_PAGE)
  }, [currentPage, filteredQuizzes])

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
      toast.success('Arquivos enviados com sucesso.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar arquivos para o Supabase.'
      setErrorMessage(message)
      toast.error(message)
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
        toast.success('Login realizado com sucesso.')
      } else {
        await signUpWithEmailAndInviteToken(email, password, inviteToken)
        setAuthMode('login')
        setAuthError('Cadastro realizado. Faça login para continuar.')
        toast.success('Cadastro realizado com sucesso.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha na autenticação.'
      setAuthError(message)
      toast.error(message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOutUser()
      resetViewer()
      toast.success('Logout realizado com sucesso.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao sair da conta.'
      setErrorMessage(message)
      toast.error(message)
    }
  }

  if (!authChecked) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center bg-slate-950 px-4 py-6 text-slate-100">
        <p className="text-sm text-slate-300">Carregando autenticação...</p>
        <ToastContainer position="top-right" autoClose={3500} theme="dark" />
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
        <ToastContainer position="top-right" autoClose={3500} theme="dark" />
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
            className="inline-flex items-center gap-2 rounded-md border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
              <path
                d="M14 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a1 1 0 0 0 1-1v-3m-4-5h11m0 0-3-3m3 3-3 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2">
          <label className="text-sm text-slate-300">
            Matéria
            <select
              value={subjectFilter}
              onChange={(event) => {
                setSubjectFilter(event.target.value)
                setCurrentPage(1)
              }}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="all">Todas</option>
              {subjectOptions.map((option) => (
                <option key={option} value={option}>
                  {formatDisplayText(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Dificuldade
            <select
              value={levelFilter}
              onChange={(event) => {
                setLevelFilter(event.target.value)
                setCurrentPage(1)
              }}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="all">Todas</option>
              {levelOptions.map((option) => (
                <option key={option} value={option}>
                  {formatDisplayText(option)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

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
                {formatDisplayText(selectedQuiz.data.subject)} · {formatDisplayText(selectedQuiz.data.level)} · {selectedQuiz.data.totalQuestions} questões
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
      <ToastContainer position="top-right" autoClose={3500} theme="dark" />
    </main>
  )
}

export default App
