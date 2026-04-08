const fs = require('fs')
const { DatabaseSync } = require('node:sqlite')
const { config } = require('../config/env.cjs')

function ensureDirectories() {
  fs.mkdirSync(config.dataDir, { recursive: true })
  fs.mkdirSync(config.privateUploadsDir, { recursive: true })
  fs.mkdirSync(config.claimProofsDir, { recursive: true })
}

ensureDirectories()

const db = new DatabaseSync(config.databasePath)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

module.exports = { db, ensureDirectories }
