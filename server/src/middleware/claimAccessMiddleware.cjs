const claimModel = require('../models/claimModel.cjs')
const { verifyClaimToken } = require('../services/claimAccessService.cjs')

function claimAccessRequired(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing claim access token.' })
  }

  try {
    const payload = verifyClaimToken(authHeader.slice('Bearer '.length), 'claim-access')
    const claim = claimModel.findById(payload.claimId)
    if (
      !claim ||
      claim.status !== 'access_granted' ||
      claim.access_token_jti == null ||
      claim.access_token_jti !== payload.jti
    ) {
      return res.status(403).json({ message: 'Claim access is not active.' })
    }

    req.claimAccess = payload
    req.claimRecord = claim
    return next()
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired claim access token.' })
  }
}

module.exports = { claimAccessRequired }
