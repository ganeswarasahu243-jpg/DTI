const crypto = require('crypto')
const { db } = require('../db/database.cjs')
const { nowIso } = require('../utils/time.cjs')

const insertStmt = db.prepare(`
  INSERT INTO trusted_circle (
    id, owner_user_id, nominee_user_id, nominee_email_hash,
    nominee_email_encrypted, nominee_name_encrypted, status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
`)
const listByOwnerStmt = db.prepare('SELECT * FROM trusted_circle WHERE owner_user_id = ? AND status = \'active\'')
const countByOwnerStmt = db.prepare(`
  SELECT COUNT(*) AS count
  FROM trusted_circle
  WHERE owner_user_id = ? AND status = 'active'
`)
const findByIdStmt = db.prepare('SELECT * FROM trusted_circle WHERE id = ?')
const findByOwnerAndEmailHashStmt = db.prepare(`
  SELECT * FROM trusted_circle
  WHERE owner_user_id = ? AND nominee_email_hash = ? AND status = 'active'
`)
const authorizedNomineeStmt = db.prepare(`
  SELECT * FROM trusted_circle
  WHERE owner_user_id = ? AND nominee_user_id = ? AND status = 'active'
`)
const authorizedNomineeByEmailHashStmt = db.prepare(`
  SELECT * FROM trusted_circle
  WHERE owner_user_id = ? AND nominee_email_hash = ? AND status = 'active'
`)
const deleteByOwnerStmt = db.prepare('DELETE FROM trusted_circle WHERE owner_user_id = ?')

function addNominee({ ownerUserId, nomineeUserId, nomineeEmailHash, nomineeEmailEncrypted, nomineeNameEncrypted }) {
  insertStmt.run(
    crypto.randomUUID(),
    ownerUserId,
    nomineeUserId || null,
    nomineeEmailHash,
    nomineeEmailEncrypted,
    nomineeNameEncrypted,
    nowIso(),
  )
}

function listByOwner(ownerUserId) {
  return listByOwnerStmt.all(ownerUserId)
}

function countByOwner(ownerUserId) {
  return countByOwnerStmt.get(ownerUserId)?.count || 0
}

function findById(id) {
  return findByIdStmt.get(id) || null
}

function findByOwnerAndEmailHash(ownerUserId, emailHash) {
  return findByOwnerAndEmailHashStmt.get(ownerUserId, emailHash) || null
}

function isAuthorizedNominee(ownerUserId, nomineeUserId) {
  return Boolean(authorizedNomineeStmt.get(ownerUserId, nomineeUserId))
}

function isAuthorizedNomineeByEmailHash(ownerUserId, nomineeEmailHash) {
  return Boolean(authorizedNomineeByEmailHashStmt.get(ownerUserId, nomineeEmailHash))
}

function deleteByOwner(ownerUserId) {
  deleteByOwnerStmt.run(ownerUserId)
}

module.exports = {
  addNominee,
  listByOwner,
  countByOwner,
  findById,
  findByOwnerAndEmailHash,
  isAuthorizedNominee,
  isAuthorizedNomineeByEmailHash,
  deleteByOwner,
}
