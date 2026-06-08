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
    threshold: 1,
  })
  const priyaNominee = upsertDemoUser({
    email: 'priya@loom-demo.local',
    name: 'Priya Nominee',
    phone: '+15550000011',
    passwordHash: demoPasswordHash,
    role: 'nominee',
    preferredOtpChannel: 'sms',
    inactivityTimerDays: 30,
    threshold: 1,
  })
  const marcusNominee = upsertDemoUser({
    email: 'marcus@loom-demo.local',
    name: 'Marcus Nominee',
    phone: '+15550000012',
    passwordHash: demoPasswordHash,
    role: 'nominee',
    preferredOtpChannel: 'sms',
    inactivityTimerDays: 30,
    threshold: 1,
  })
  const estateOwner = upsertDemoUser({
    email: 'estate.owner@loom-demo.local',
    name: 'Ethan Estate',
    phone: null,
    passwordHash: demoPasswordHash,
    role: 'user',
    preferredOtpChannel: 'email',
    inactivityTimerDays: 45,
    threshold: 1,
  })

  trustedCircleModel.deleteByOwner(owner.id)
  trustedCircleModel.deleteByOwner(estateOwner.id)

  addTrustedNominee({
    ownerUserId: owner.id,
    nomineeUserId: priyaNominee.id,
    nomineeEmail: 'priya@loom-demo.local',
    nomineeName: 'Priya Nominee',
  })
  addTrustedNominee({
    ownerUserId: owner.id,
    nomineeUserId: marcusNominee.id,
    nomineeEmail: 'marcus@loom-demo.local',
    nomineeName: 'Marcus Nominee',
  })
  addTrustedNominee({
    ownerUserId: estateOwner.id,
    nomineeUserId: owner.id,
    nomineeEmail: 'owner@loom-demo.local',
    nomineeName: 'Olivia Owner',
  })

  assetModel.deleteByUser(owner.id)
  assetModel.deleteByUser(estateOwner.id)
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
  assetModel.createAsset({
    userId: estateOwner.id,
    title: 'Estate Recovery File',
    type: 'Legal Document',
    encryptedDetails: encryptText('Executor notes, probate checklist, and key contact approvals for estate transfer.'),
    encryptedFinancialData: encryptText('Settlement reserve: $125,000 secured for dependent beneficiaries.'),
  })
}

function upsertDemoUser({ email, name, phone, passwordHash, role, preferredOtpChannel, inactivityTimerDays, threshold }) {
  const normalizedPhone = phone ? String(phone).trim() : null
  const existing = userModel.findByEmail(email)
  const seedPayload = {
    emailEncrypted: encryptText(email),
    nameEncrypted: encryptText(name),
    phoneHash: normalizedPhone ? hashLookup(normalizedPhone) : null,
    phoneEncrypted: normalizedPhone ? encryptText(normalizedPhone) : null,
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

function addTrustedNominee({
  ownerUserId,
  nomineeUserId,
  nomineeEmail,
  nomineeName,
}) {
  trustedCircleModel.addNominee({
    ownerUserId,
    nomineeUserId,
    nomineeEmailHash: hashLookup(nomineeEmail),
    nomineeEmailEncrypted: encryptText(nomineeEmail),
    nomineeNameEncrypted: encryptText(nomineeName),
  })
}

module.exports = { ensureDemoSeed }
