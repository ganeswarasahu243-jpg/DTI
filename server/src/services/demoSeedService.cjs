const bcrypt = require('bcryptjs')
const assetModel = require('../models/assetModel.cjs')
const trustedCircleModel = require('../models/trustedCircleModel.cjs')
const userModel = require('../models/userModel.cjs')
const { config } = require('../config/env.cjs')
const { encryptText, hashLookup } = require('./encryptionService.cjs')

async function ensureDemoSeed() {
  if (config.env !== 'development') {
    return
  }

  const demoPasswordHash = await bcrypt.hash('DemoPass123!', 12)
  const owner = upsertDemoUser({
    email: 'owner@loom-demo.local',
    name: 'Olivia Owner',
    phone: '+15550000001',
    passwordHash: demoPasswordHash,
    role: 'user',
    preferredOtpChannel: 'email',
    inactivityTimerDays: 30,
    threshold: 2,
  })

  const nomineeOne = upsertDemoUser({
    email: 'priya@loom-demo.local',
    name: 'Priya Nominee',
    phone: '+15550000002',
    passwordHash: demoPasswordHash,
    role: 'nominee',
    preferredOtpChannel: 'email',
    inactivityTimerDays: 30,
    threshold: 2,
  })

  const nomineeTwo = upsertDemoUser({
    email: 'marcus@loom-demo.local',
    name: 'Marcus Nominee',
    phone: '+15550000003',
    passwordHash: demoPasswordHash,
    role: 'nominee',
    preferredOtpChannel: 'sms',
    inactivityTimerDays: 30,
    threshold: 2,
  })

  trustedCircleModel.deleteByOwner(owner.id)
  trustedCircleModel.addNominee({
    ownerUserId: owner.id,
    nomineeUserId: nomineeOne.id,
    nomineeEmailHash: hashLookup('priya@loom-demo.local'),
    nomineeEmailEncrypted: encryptText('priya@loom-demo.local'),
    nomineeNameEncrypted: encryptText('Priya Nominee'),
  })
  trustedCircleModel.addNominee({
    ownerUserId: owner.id,
    nomineeUserId: nomineeTwo.id,
    nomineeEmailHash: hashLookup('marcus@loom-demo.local'),
    nomineeEmailEncrypted: encryptText('marcus@loom-demo.local'),
    nomineeNameEncrypted: encryptText('Marcus Nominee'),
  })

  assetModel.deleteByUser(owner.id)
  assetModel.createAsset({
    userId: owner.id,
    title: 'Family Trust Ledger',
    type: 'Trust Document',
    encryptedDetails: encryptText('Primary trust allocation, trustee instructions, and beneficiary distribution notes.'),
    encryptedFinancialData: encryptText('Portfolio reserve: $410,000. Settlement account reference ending in 1902.'),
  })
  assetModel.createAsset({
    userId: owner.id,
    title: 'Digital Wallet Custody Notes',
    type: 'Digital Asset',
    encryptedDetails: encryptText('Custody process, multisig recovery instructions, and exchange transfer checklist.'),
    encryptedFinancialData: encryptText('Treasury wallet reserve: 12.45 BTC equivalent under estate governance.'),
  })
}

function upsertDemoUser({ email, name, phone, passwordHash, role, preferredOtpChannel, inactivityTimerDays, threshold }) {
  const existing = userModel.findByEmail(email)
  const seedPayload = {
    emailEncrypted: encryptText(email),
    nameEncrypted: encryptText(name),
    phoneHash: hashLookup(phone),
    phoneEncrypted: encryptText(phone),
    passwordHash,
    role,
    preferredOtpChannel,
    inactivityTimerDays,
    threshold,
  }

  if (!existing) {
    const user = userModel.createUser({
      emailHash: hashLookup(email),
      ...seedPayload,
    })
    userModel.markEmailVerified(user.id)
    return userModel.findById(user.id)
  }

  const updatedUser = userModel.updateUserForSeed(existing.id, seedPayload)
  userModel.markEmailVerified(updatedUser.id)
  return userModel.findById(updatedUser.id)
}

module.exports = { ensureDemoSeed }
