const trustedCircleModel = require('../models/trustedCircleModel.cjs')

function computeMajorityThreshold(count) {
  if (count <= 0) {
    return 0
  }

  return Math.floor(count / 2) + 1
}

function getTrustedCircleSummary(ownerUserId, requestedThreshold) {
  const nomineeCount = trustedCircleModel.countByOwner(ownerUserId)
  const minimumThreshold = computeMajorityThreshold(nomineeCount)
  const configuredThreshold = Number(requestedThreshold || 0)
  const effectiveThreshold = Math.max(configuredThreshold, minimumThreshold)

  return {
    nomineeCount,
    minimumThreshold,
    effectiveThreshold,
  }
}

module.exports = {
  computeMajorityThreshold,
  getTrustedCircleSummary,
}
