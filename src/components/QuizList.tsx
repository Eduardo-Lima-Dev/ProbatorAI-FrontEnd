import type { UploadedQuiz } from '../types/quiz'
import { formatDisplayText } from '../lib/text'

type QuizListProps = {
  quizzes: UploadedQuiz[]
  currentPage: number
  totalPages: number
  onChangePage: (page: number) => void
  onOpenQuiz: (quizId: string) => void
}

const formatQuizTitle = (subject: string) => {
  return `Quiz ${formatDisplayText(subject)}`
}

function QuizList({ quizzes, currentPage, totalPages, onChangePage, onOpenQuiz }: QuizListProps) {
  if (quizzes.length === 0 && currentPage === 1) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-300">
        Nenhum quiz carregado. Faça upload de arquivos JSON para começar.
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {quizzes.map((quiz) => (
          <button
            key={quiz.id}
            type="button"
            onClick={() => onOpenQuiz(quiz.id)}
            className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-indigo-400 hover:bg-slate-800"
          >
            <h2 className="truncate text-base font-semibold text-slate-100">{formatQuizTitle(quiz.data.subject)}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {formatDisplayText(quiz.data.subject)} · {formatDisplayText(quiz.data.level)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {quiz.data.totalQuestions} questões · origem: {quiz.sourceType}
            </p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <button
          type="button"
          onClick={() => onChangePage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="px-2 text-sm text-slate-300">
          Página {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChangePage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </section>
  )
}

export default QuizList
