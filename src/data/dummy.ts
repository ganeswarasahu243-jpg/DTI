export type Asset = {
  id: string
  title: string
  type: string
  value: string
  status: string
  vault: string
  description: string
  lastUpdated: string
  performance: string
  details: string
}

export const assets: Asset[] = [
  {
    id: '1',
    title: 'Equity Trust',
    type: 'Investment',
    value: '$415,800',
    status: 'Secured',
    vault: 'Legacy Vault',
    description: 'Managed equity holdings and retirement reserve.',
    lastUpdated: '2 hours ago',
    performance: '+11.8%',
    details: 'Stable wealth allocation across diversified equity assets, designed to preserve long-term value for heirs.',
  },
  {
    id: '2',
    title: 'Private Crypto Vault',
    type: 'Digital Asset',
    value: '$84,380',
    status: 'Protected',
    vault: 'Crypto Reserve',
    description: 'Cold storage wallets for digital inheritance distribution.',
    lastUpdated: '1 day ago',
    performance: '+24.5%',
    details: 'Encrypted private key storage with beneficiary loadouts and transfer triggers.',
  },
  {
    id: '3',
    title: 'Property Conveyance',
    type: 'Real Estate',
    value: '$620,000',
    status: 'Active',
    vault: 'Estate Vault',
    description: 'Deed and title data for a city condominium unit.',
    lastUpdated: '4 days ago',
    performance: '+6.4%',
    details: 'Title documents, insurance index, and occupancy instructions to support seamless handover.',
  },
]

export const recentActivity = [
  { id: 'a1', label: 'Nominee invited', detail: 'Added Priya N. as primary nominee.', time: '3m ago' },
  { id: 'a2', label: 'Asset updated', detail: 'Investment risk profile refinanced.', time: '1h ago' },
  { id: 'a3', label: 'Security audit', detail: 'MFA and vault key rotation completed.', time: '6h ago' },
]

export const nominees = [
  { id: 'n1', name: 'Priya N.', role: 'Primary Beneficiary', email: 'priya@loomfinance.com' },
  { id: 'n2', name: 'Marcus A.', role: 'Contingent Beneficiary', email: 'marcus@loomfinance.com' },
]

export const activityLogs = [
  { id: 'log1', title: 'Login from new device', description: 'Verified with secondary email.', date: 'Today at 09:15', status: 'Success' },
  { id: 'log2', title: 'Account permission changed', description: 'Shared access revoked from external advisor.', date: 'Yesterday at 17:40', status: 'Success' },
  { id: 'log3', title: 'Failed sign-in attempt', description: 'Unrecognized IP blocked.', date: 'Mar 28 at 20:03', status: 'Alert' },
]

export const faqList = [
  { id: 'f1', question: 'How can I add a new asset?', answer: 'Go to the Add Asset page, fill in the asset overview, and publish it to your portfolio.' },
  { id: 'f2', question: 'What does digital inheritance mean?', answer: 'LOOM secures your financial and estate data so nominated heirs receive assets automatically under your chosen rules.' },
  { id: 'f3', question: 'How do I manage nominees?', answer: 'Visit Nominee Management to update beneficiaries, roles, and access priorities in real time.' },
]

export const profileInfo = {
  name: 'Ariana Ray',
  email: 'ariana@loomfinance.com',
  plan: 'Enterprise Family',
  lastUpdated: 'Updated 2 days ago',
  summary: 'A premium user protecting generational wealth, inheritance flows, and legacy liquidity.',
}
