const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { config } = require('../config/env.cjs')

function signClaimPortalToken(claim, stage) {
  return jwt.sign(
    {
      purpose: 'claim-portal',
      claimId: claim.id,
      ownerUserId: claim.owner_user_id,
      stage,
    },
    config.claimAccessSecret,
    { expiresIn: '2h' },
  )
}

function signClaimAccessToken(claim, assetIds) {
  const jti = crypto.randomUUID()
  return {
    jti,
    token: jwt.sign(
      {
        purpose: 'claim-access',
        jti,
        claimId: claim.id,
        ownerUserId: claim.owner_user_id,
        scope: 'read-only-assets',
        assetIds,
      },
      config.claimAccessSecret,
      { expiresIn: `${config.claimAccessTokenMinutes}m` },
    ),
  }
}

function verifyClaimToken(token, purpose) {
  const payload = jwt.verify(token, config.claimAccessSecret)
  if (payload.purpose !== purpose) {
    throw new Error('Invalid claim token purpose.')
  }

  return payload
}

module.exports = {
  signClaimPortalToken,
  signClaimAccessToken,
  verifyClaimToken,
}
