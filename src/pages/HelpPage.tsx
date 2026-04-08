import { faqList } from '../data/dummy'
import { Button } from '../components/ui/Button'

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Help</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Get quick answers and premium support.</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Find guidance on onboarding, asset management, and nominee controls.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.7fr_0.3fr]">
        <div className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
          {faqList.map((faq) => (
            <details key={faq.id} className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
              <summary className="cursor-pointer text-lg font-semibold text-white">{faq.question}</summary>
              <p className="mt-3 text-sm leading-7 text-slate-400">{faq.answer}</p>
            </details>
          ))}
        </div>
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Need support?</p>
          <div className="mt-6 space-y-4 text-slate-400">
            <p>Contact our team for guidance on legacy asset workflows, nominee policy, and secure transfers.</p>
            <p>Email: support@loomfinance.com</p>
            <p>Phone: +1 (888) 564-LOOM</p>
          </div>
          <Button className="mt-6 w-full">Request support</Button>
        </div>
      </div>
    </div>
  )
}
