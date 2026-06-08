const assetModel = require('../models/assetModel.cjs')
const trustedCircleModel = require('../models/trustedCircleModel.cjs')
const userModel = require('../models/userModel.cjs')
const { decryptText, hashLookup } = require('../services/encryptionService.cjs')

function getCurrentPrincipal(req) {
  return req.currentUser || req.currentAdmin
}

function listNomineeVaults(req, res) {
  const principal = getCurrentPrincipal(req)
  if (!principal) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  const nomineeUserId = principal.id
  const nomineeEmailHash = principal.email ? hashLookup(principal.email) : null

  const byUserId = trustedCircleModel.listByNomineeUserId(nomineeUserId)
  const byEmailHash = nomineeEmailHash ? trustedCircleModel.listByNomineeEmailHash(nomineeEmailHash) : []
  const candidateEntries = [...byUserId, ...byEmailHash]

  const owners = new Map()
  for (const entry of candidateEntries) {
    if (!entry?.owner_user_id) {
      continue
    }
    owners.set(entry.owner_user_id, entry)
  }

  const vaults = []
  for (const ownerUserId of owners.keys()) {
    const allowedByUserId = trustedCircleModel.isAuthorizedNominee(ownerUserId, nomineeUserId)
    const allowedByEmail = nomineeEmailHash
      ? trustedCircleModel.isAuthorizedNomineeByEmailHash(ownerUserId, nomineeEmailHash)
      : false

    if (!allowedByUserId && !allowedByEmail) {
      continue
    }

    const owner = userModel.findById(ownerUserId)
    if (!owner) {
      continue
    }

    const records = assetModel.listByUser(ownerUserId)
    const ownerName = decryptText(owner.name_encrypted)
    const ownerEmail = decryptText(owner.email_encrypted)

    vaults.push({
      id: `nominee-vault-${ownerUserId}`,
      ownerUserId,
      ownerName,
      ownerEmail,
      assetCount: records.length,
      preview: records.slice(0, 3).map((asset) => ({
        id: asset.id,
        title: asset.title,
        type: asset.type,
        updatedAt: asset.updated_at,
      })),
      eligibleForClaim: records.length > 0,
    })
  }

  return res.json({
    vaults,
    count: vaults.length,
  })
}

module.exports = {
  listNomineeVaults,
}
