const LOCALE = 'pt-BR'

const capitalizeSegment = (segment: string) => {
  if (!segment) return segment
  return segment.charAt(0).toLocaleUpperCase(LOCALE) + segment.slice(1)
}

export const formatDisplayText = (value: string) => {
  const normalized = value.trim().toLocaleLowerCase(LOCALE)
  if (!normalized) return ''

  return normalized
    .split(/\s+/)
    .map((word) => word.split('-').map(capitalizeSegment).join('-'))
    .join(' ')
}
