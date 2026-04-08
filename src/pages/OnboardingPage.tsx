import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'

const steps = [
  { title: 'Identity', description: 'Confirm your personal information to complete the secure workflow.' },
  { title: 'Asset setup', description: 'Register your first inheritance asset and assign priority details.' },
  { title: 'Security', description: 'Protect your vault and nominee flow with verification rules.' },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [form, setForm] = useState({ fullName: 'Ariana Ray', assetName: 'Equity Trust', accessKey: 'Active' })

  const handleNext = () => {
    if (currentStep === steps.length - 1) {
      navigate('/dashboard')
      return
    }
    setCurrentStep((value) => value + 1)
  }

  const stepConfig = [
    {
      label: 'Full name',
      value: form.fullName,
      placeholder: 'Enter your full name',
      key: 'fullName',
    },
    {
      label: 'Asset name',
      value: form.assetName,
      placeholder: 'My family trust asset',
      key: 'assetName',
    },
    {
      label: 'Access mode',
      value: form.accessKey,
      placeholder: 'Active / locked',
      key: 'accessKey',
    },
  ]

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-800/80 bg-slate-950/85 p-8 shadow-2xl shadow-slate-950/20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_0.55fr] lg:items-start">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Onboarding</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">Complete your premium inheritance setup.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">Walk through the initial setup to protect assets, select nominees, and lock your security posture.</p>

            <div className="mt-10 space-y-8 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Step {currentStep + 1} / {steps.length}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{steps[currentStep].title}</h2>
                  <p className="mt-2 text-slate-400">{steps[currentStep].description}</p>
                </div>
                <div className="rounded-3xl bg-slate-900/90 px-4 py-3 text-sm text-slate-300">Progress {Math.round(((currentStep + 1) / steps.length) * 100)}%</div>
              </div>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block text-slate-400">{stepConfig[currentStep].label}</span>
                <input
                  value={stepConfig[currentStep].value}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [stepConfig[currentStep].key]: event.target.value }))
                  }
                  placeholder={stepConfig[currentStep].placeholder}
                  className="w-full rounded-3xl border border-slate-800/80 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-x-2 text-sm text-slate-400">
                  {steps.map((step, index) => (
                    <span key={step.title} className={index === currentStep ? 'text-white' : 'text-slate-600'}>
                      {step.title}
                    </span>
                  ))}
                </div>
                <Button onClick={handleNext}>{currentStep === steps.length - 1 ? 'Finish onboarding' : 'Continue'}</Button>
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-800/80 bg-slate-950/90 p-6 text-sm text-slate-400">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Fast facts</p>
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl bg-slate-900/85 p-4">
                <p className="text-slate-200">Asset readiness</p>
                <p className="mt-2 text-3xl font-semibold text-white">97%</p>
              </div>
              <div className="rounded-3xl bg-slate-900/85 p-4">
                <p className="text-slate-200">Nominee mapping</p>
                <p className="mt-2 text-3xl font-semibold text-white">4 contacts</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
