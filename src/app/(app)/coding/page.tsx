import ModePage from '@/components/ModePage';
export const metadata = { title: 'Coding' };
const LANGS = ['Any', 'Python', 'JavaScript', 'TypeScript', 'Java', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'SQL', 'Bash', 'HTML/CSS', 'Kotlin', 'Swift'];
export default function Page(p: { searchParams: Promise<{ c?: string }> }) {
  return <ModePage mode="coding" title="Coding" blurb="Generate, explain, debug and improve code. Paste code or an error message below." languages={LANGS}
    placeholder="Paste code or describe what you need. Shift+Enter for a new line." emptyTitle="What are we building?"
    starters={['Explain this error: TypeError: undefined is not a function', 'Generate a REST API project structure in Node.js', 'Refactor my function to be more readable', 'Explain async/await with an example']} searchParams={p.searchParams} />;
}
