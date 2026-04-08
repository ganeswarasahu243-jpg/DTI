const userModel = require('../models/userModel.cjs')
const { handleUserActivity } = require('../services/releaseService.cjs')

function trackActivity(req, _res, next) {
  if (req.currentUser) {
    userModel.touchActivity(req.currentUser.id)
    handleUserActivity(req.currentUser)
  }

  return next()
}

module.exports = { trackActivity }
