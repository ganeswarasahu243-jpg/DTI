const crypto = require('crypto')
const { db } = require('../db/database.cjs')
const { nowIso } = require('../utils/time.cjs')

const createStmt = db.prepare(`
  INSERT INTO assets (
    id, user_id, title, type, encrypted_details, encrypted_financial_data,
    file_name_encrypted, file_mime_type, file_storage_key, file_size,
    file_cipher_meta, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const findByIdStmt = db.prepare('SELECT * FROM assets WHERE id = ?')
const findByFileStmt = db.prepare('SELECT * FROM assets WHERE file_storage_key = ?')
const listByUserStmt = db.prepare(`
  SELECT assets.*, users.name_encrypted AS owner_name_encrypted, users.email_encrypted AS owner_email_encrypted
  FROM assets
  INNER JOIN users ON users.id = assets.user_id
  WHERE assets.user_id = ?
  ORDER BY datetime(assets.updated_at) DESC, datetime(assets.created_at) DESC
`)
const listAccessibleToNomineeStmt = db.prepare(`
  SELECT assets.*, users.name_encrypted AS owner_name_encrypted, users.email_encrypted AS owner_email_encrypted
  FROM assets
  INNER JOIN trusted_circle ON trusted_circle.owner_user_id = assets.user_id
  INNER JOIN users ON users.id = assets.user_id
  WHERE trusted_circle.nominee_user_id = ?
    AND trusted_circle.status = 'active'
  ORDER BY datetime(assets.updated_at) DESC, datetime(assets.created_at) DESC
`)
const listAccessibleToNomineeEmailHashStmt = db.prepare(`
  SELECT assets.*, users.name_encrypted AS owner_name_encrypted, users.email_encrypted AS owner_email_encrypted
  FROM assets
  INNER JOIN trusted_circle ON trusted_circle.owner_user_id = assets.user_id
  INNER JOIN users ON users.id = assets.user_id
  WHERE trusted_circle.nominee_email_hash = ?
    AND trusted_circle.status = 'active'
  ORDER BY datetime(assets.updated_at) DESC, datetime(assets.created_at) DESC
`)
const deleteByUserStmt = db.prepare('DELETE FROM assets WHERE user_id = ?')

function createAsset(payload) {
  const id = crypto.randomUUID()
  const timestamp = nowIso()
  createStmt.run(
    id,
    payload.userId,
    payload.title,
    payload.type,
    payload.encryptedDetails,
    payload.encryptedFinancialData || null,
    payload.fileNameEncrypted || null,
    payload.fileMimeType || null,
    payload.fileStorageKey || null,
    payload.fileSize || null,
    payload.fileCipherMeta || null,
    timestamp,
    timestamp,
  )

  return findById(id)
}

function findById(id) {
  return findByIdStmt.get(id) || null
}

function findByFileStorageKey(storageKey) {
  return findByFileStmt.get(storageKey) || null
}

function listByUser(userId) {
  return listByUserStmt.all(userId)
}

function listAccessibleToNominee(nomineeUserId) {
  return listAccessibleToNomineeStmt.all(nomineeUserId)
}

function listAccessibleToNomineeByEmailHash(nomineeEmailHash) {
  return listAccessibleToNomineeEmailHashStmt.all(nomineeEmailHash)
}

function deleteByUser(userId) {
  deleteByUserStmt.run(userId)
}

module.exports = {
  createAsset,
  findById,
  findByFileStorageKey,
  listByUser,
  listAccessibleToNominee,
  listAccessibleToNomineeByEmailHash,
  deleteByUser,
}
