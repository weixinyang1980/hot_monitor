export function getNextHalfHour(date = new Date()) {
  const next = new Date(date)
  if ((next.getMinutes() === 0 || next.getMinutes() === 30) && next.getSeconds() === 0 && next.getMilliseconds() === 0) return next
  next.setSeconds(0, 0)
  const minutes = next.getMinutes()
  if (minutes < 30) next.setMinutes(30)
  else {
    next.setMinutes(0)
    next.setHours(next.getHours() + 1)
  }
  return next
}

export function startHalfHourScheduler(task: () => void, date = new Date()) {
  const next = getNextHalfHour(date)
  const delay = Math.max(0, next.getTime() - date.getTime())
  const timeout = setTimeout(() => {
    task()
    setInterval(task, 30 * 60 * 1000)
  }, delay)
  return { next, timeout }
}
