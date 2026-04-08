const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { z } = require('zod')
const assetModel = require('../models/assetModel.cjs')
const trustedCircleModel = require('../models/trustedCircleModel.cjs')
const releaseRequestModel = require('../models/releaseRequestModel.cjs')
const auditLogService = require('../services/auditLogService.cjs')
const { encryptText, decryptText, encryptBuffer, decryptBuffer } = require('../services/encryptionService.cjs')
const { hashLookup } = require('../services/encryptionService.cjs')
const { signUrl, verifyUrl } = require('../services/signedUrlService.cjs')
const { config } = require('../config/env.cjs')

const assetSchema = z.object({
  title: z.string().trim().min(3).max(120),
  type: z.string().trim().min(2).max(40),
  details: z.string().trim().min(10).max(5000),
  financialData: z.string().trim().max(5000).optional(),
  file: z.object({
    name: z.string().trim().min(1).max(255),
    mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
    base64: z.string().min(1),
  }).optional(),
})

function canAccessAsset(userId, asset) {
  return asset.user_id === userId
}

function isTrustedNomineeForAsset(principal, asset) {
  return trustedCircleModel.isAuthorizedNominee(asset.user_id, principal.id) || (
    principal.email
      ? trustedCircleModel.isAuthorizedNomineeByEmailHash(asset.user_id, hashLookup(principal.email))
      : false
  )
}

function decodeBase64(base64) {
  return Buffer.from(base64, 'base64')
}

function safeDownloadName(value) {
  return value.replace(/[\r\n"]/g, '_')
}

function matchesFileSignature(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 4).toString('utf8') === '%PDF'
  }

  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }

  if (mimeType === 'image/jpeg') {
    return buffer[0] === 255 && buffer[1] === 216
  }

  return false
}

function serializeAssetSummary(asset) {
  return {
    id: asset.id,
    title: asset.title,
    type: asset.type,
    details: decryptText(asset.encrypted_details),
    financialData: asset.encrypted_financial_data ? decryptText(asset.encrypted_financial_data) : null,
    hasFile: Boolean(asset.file_storage_key),
    fileMimeType: asset.file_mime_type,
    createdAt: asset.created_at,
    updatedAt: asset.updated_at,
    ownerName: asset.owner_name_encrypted ? decryptText(asset.owner_name_encrypted) : null,
    ownerEmail: asset.owner_email_encrypted ? decryptText(asset.owner_email_encrypted) : null,
  }
}

function getCurrentPrincipal(req) {
  return req.currentUser || req.currentAdmin
}

function createAsset(req, res) {
  const principal = getCurrentPrincipal(req)
  if (!principal) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  const parsed = assetSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid asset payload.', issues: parsed.error.flatten() })
  }

  let filePayload = {}
  if (parsed.data.file) {
    const fileBuffer = decodeBase64(parsed.data.file.base64)
    if (fileBuffer.length > config.fileSizeLimitBytes) {
      return res.status(400).json({ message: 'Uploaded file exceeds the configured size limit.' })
    }

    if (!matchesFileSignature(fileBuffer, parsed.data.file.mimeType)) {
      return res.status(400).json({ message: 'Uploaded file contents do not match the allowed file type.' })
    }

    const storageKey = `${crypto.randomUUID()}${path.extname(parsed.data.file.name).toLowerCase()}`
    const encryptedFile = encryptBuffer(fileBuffer)
    fs.writeFileSync(path.join(config.privateUploadsDir, storageKey), encryptedFile.buffer)

    filePayload = {
      fileNameEncrypted: encryptText(parsed.data.file.name),
      fileMimeType: parsed.data.file.mimeType,
      fileStorageKey: storageKey,
      fileSize: fileBuffer.length,
      fileCipherMeta: encryptedFile.meta,
    }
  }

  const principalId = principal.id
  const asset = assetModel.createAsset({
    userId: principalId,
    title: parsed.data.title,
    type: parsed.data.type,
    encryptedDetails: encryptText(parsed.data.details),
    encryptedFinancialData: parsed.data.financialData ? encryptText(parsed.data.financialData) : null,
    ...filePayload,
  })

  auditLogService.logEvent({
    userId: principal.id,
    requestId: req.requestId,
    eventType: 'asset_created',
    severity: 'info',
    message: 'Secure asset stored with encrypted fields.',
    metadata: { assetId: asset.id },
  })

  return res.status(201).json({ assetId: asset.id })
}

function listAssets(req, res) {
  const principal = getCurrentPrincipal(req)
  if (!principal) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  let records
  if (principal.role === 'nominee') {
    const byUserId = assetModel.listAccessibleToNominee(principal.id)
    const byEmail = principal.email ? assetModel.listAccessibleToNomineeByEmailHash(hashLookup(principal.email)) : []
    const deduped = new Map([...byUserId, ...byEmail].map((asset) => [asset.id, asset]))
    records = [...deduped.values()]
  } else {
    records = assetModel.listByUser(principal.id)
  }

  const assets = records.map(serializeAssetSummary)

  return res.json({
    assets,
    count: assets.length,
  })
}

function getAsset(req, res) {
  const principal = getCurrentPrincipal(req)
  if (!principal) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  const asset = assetModel.findById(req.params.assetId)
  if (!asset) {
    return res.status(404).json({ message: 'Asset not found.' })
  }

  const authorized = canAccessAsset(principal.id, asset) || isTrustedNomineeForAsset(principal, asset)
  if (!authorized) {
    return res.status(403).json({ message: 'You are not authorized to access this asset.' })
  }

  auditLogService.logEvent({
    userId: principal.id,
    requestId: req.requestId,
    eventType: 'asset_accessed',
    severity: 'info',
    message: 'Sensitive asset data decrypted for authorized access.',
    metadata: { assetId: asset.id },
  })

  return res.json({
    ...serializeAssetSummary(asset),
  })
}

function createSignedDownloadUrl(req, res) {
  const principal = getCurrentPrincipal(req)
  if (!principal) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  const asset = assetModel.findById(req.params.assetId)
  if (!asset || !asset.file_storage_key) {
    return res.status(404).json({ message: 'Asset file not found.' })
  }

  const authorized = canAccessAsset(principal.id, asset) || isTrustedNomineeForAsset(principal, asset)
  if (!authorized) {
    return res.status(403).json({ message: 'You are not authorized to access this asset file.' })
  }

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const url = signUrl({
    storageKey: asset.file_storage_key,
    assetId: asset.id,
    userId: principal.id,
    expiresAt,
  })

  auditLogService.logEvent({
    userId: principal.id,
    requestId: req.requestId,
    eventType: 'asset_file_signed_url_created',
    severity: 'info',
    message: 'Created short-lived signed download URL for encrypted asset file.',
    metadata: { assetId: asset.id, expiresAt },
  })

  return res.json({ signedUrl: url, expiresAt })
}

function downloadFile(req, res) {
  const principal = getCurrentPrincipal(req)
  if (!principal) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  const { fileId } = req.params
  const { assetId, expires, signature } = req.query
  const asset = assetModel.findByFileStorageKey(fileId)

  if (!asset || asset.id !== assetId) {
    return res.status(404).json({ message: 'Secure file not found.' })
  }

  const authorized = canAccessAsset(principal.id, asset) || isTrustedNomineeForAsset(principal, asset)
  if (!authorized) {
    return res.status(403).json({ message: 'You are not authorized to download this file.' })
  }

  const validSignature = verifyUrl({
    storageKey: fileId,
    assetId,
    userId: principal.id,
    expires,
    signature,
  })

  if (!validSignature) {
    return res.status(403).json({ message: 'Invalid or expired signed URL.' })
  }

  const encryptedFile = fs.readFileSync(path.join(config.privateUploadsDir, fileId))
  const decrypted = decryptBuffer(encryptedFile, asset.file_cipher_meta)
  const downloadName = safeDownloadName(decryptText(asset.file_name_encrypted))

  res.setHeader('Content-Type', asset.file_mime_type)
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`)
  auditLogService.logEvent({
    userId: principal.id,
    requestId: req.requestId,
    eventType: 'asset_file_downloaded',
    severity: 'warn',
    message: 'Encrypted asset file downloaded through signed URL.',
    metadata: { assetId: asset.id, fileId },
  })
  return res.send(decrypted)
}

function transferAsset(req, res) {
  const principal = getCurrentPrincipal(req)
  if (!principal) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  const asset = assetModel.findById(req.params.assetId)
  if (!asset || asset.user_id !== principal.id) {
    return res.status(404).json({ message: 'Asset not found.' })
  }

  auditLogService.logEvent({
    userId: principal.id,
    requestId: req.requestId,
    eventType: 'asset_transfer_requested',
    severity: 'warn',
    message: 'Sensitive asset transfer was initiated and protected by MFA.',
    metadata: { assetId: asset.id },
  })

  return res.json({ status: 'transfer-requested', assetId: asset.id })
}

module.exports = {
  listAssets,
  createAsset,
  getAsset,
  createSignedDownloadUrl,
  downloadFile,
  transferAsset,
}
