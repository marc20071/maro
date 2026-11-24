import ModePage from '@/components/ModePage';
export const metadata = { title: 'Learning' };
export default function Page(p: { searchParams: Promise<{ c?: string }> }) {
  return <ModePage mode="learning" title="Learning" blurb="Explanations, summaries, practice questions and quizzes at your level."
    levels={['Beginner', 'Intermediate', 'Advanced']} placeholder="Ask a question, paste notes to summarize, or request a quiz…" emptyTitle="What are you studying?"
    starters={['Explain photosynthesis step by step', 'Quiz me: 5 questions on Python loops', 'Summarize the causes of World War I', 'Solve 3x² − 12x + 9 = 0 and show each step']} searchParams={p.searchParams} />;
}
