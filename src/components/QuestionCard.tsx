import type { QuizQuestion } from '../types/quiz'

type QuestionCardProps = {
  question: QuizQuestion
  total: number
}

function QuestionCard({ question, total }: QuestionCardProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
      <p className="text-sm text-slate-400">
        {question.index} / {total}
      </p>
      <h3 className="mt-2 text-lg font-medium leading-relaxed text-slate-100">{question.question}</h3>

      <div className="mt-5 space-y-3">
        {question.alternatives.map((alternative) => {
          const isCorrect = alternative.isCorrect

          const borderClass = isCorrect ? 'border-emerald-500/70' : 'border-slate-700'
          const explanationClass = isCorrect ? 'text-emerald-300' : 'text-red-300'

          return (
            <div key={alternative.label} className={`rounded-xl border p-4 ${borderClass}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-sm font-semibold text-slate-300">{alternative.label}.</span>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-slate-100 sm:text-base">{alternative.text}</p>
                  <p className={`mt-2 text-sm ${explanationClass}`}>{alternative.explanation}</p>

                  {isCorrect ? (
                    <div className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-400">
                      <span className="inline-flex size-5 items-center justify-center rounded-full border border-emerald-400 bg-emerald-500/20">
                        ✓
                      </span>
                      Resposta correta
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}

export default QuestionCard
