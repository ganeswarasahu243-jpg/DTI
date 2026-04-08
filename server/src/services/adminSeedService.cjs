const bcrypt = require('bcryptjs')
const { config } = require('../config/env.cjs')
const adminAccountModel = require('../models/adminAccountModel.cjs')
const { encryptText, hashLookup } = require('./encryptionService.cjs')

async function ensureDemoAdminSeed() {
  const passwordHash = await bcrypt.hash(config.demoAdminPassword, 12)
  const existingAdmin = adminAccountModel.findByEmail(config.demoAdminEmail)

  if (!existingAdmin) {
    adminAccountModel.createAdminAccount({
      emailEncrypted: encryptText(config.demoAdminEmail),
      emailHash: hashLookup(config.demoAdminEmail),
      nameEncrypted: encryptText(config.demoAdminName),
      passwordHash,
    })
    return
  }

  if (config.demoAdminResetOnBoot) {
    adminAccountModel.updateCredentials(existingAdmin.id, {
      emailEncrypted: encryptText(config.demoAdminEmail),
      emailHash: hashLookup(config.demoAdminEmail),
      nameEncrypted: encryptText(config.demoAdminName),
      passwordHash,
    })
    adminAccountModel.resetLoginState(existingAdmin.id)
  }
}

module.exports = { ensureDemoAdminSeed }
