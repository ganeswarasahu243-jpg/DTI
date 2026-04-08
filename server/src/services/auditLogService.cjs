const activityLogModel = require('../models/activityLogModel.cjs')

function logEvent(payload) {
  activityLogModel.insertLog(payload)
}

module.exports = { logEvent }
