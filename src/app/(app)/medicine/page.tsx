import { TriangleAlert } from 'lucide-react';
import ModePage from '@/components/ModePage';
export const metadata = { title: 'Medicine' };
export default function Page(p: { searchParams: Promise<{ c?: string }> }) {
  return <ModePage mode="medicine" title="Medicine" blurb="General health information and education."
    notice={<div role="note" className="mb-4 flex gap-3 rounded-xl border border-saffron/40 bg-saffron-soft p-3 text-sm"><TriangleAlert className="mt-0.5 shrink-0 text-saffron" size={18} />
      <p>MARO AI is not a doctor and cannot diagnose you. For chest pain, trouble breathing, stroke signs, severe bleeding or thoughts of self-harm, contact local emergency services now.</p></div>}
    placeholder="Ask about a symptom, condition, term or medication…" emptyTitle="Ask a health question"
    starters={['What does “benign” mean on a lab report?', 'What questions should I ask my doctor about high blood pressure?', 'How can I lower my risk of type 2 diabetes?', 'What are common side effects of ibuprofen?']} searchParams={p.searchParams} />;
}
