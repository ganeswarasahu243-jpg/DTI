function nowIso() {
  return new Date().toISOString()
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000)
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

module.exports = { nowIso, addSeconds, addDays }
