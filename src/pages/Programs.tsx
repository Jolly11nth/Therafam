import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { getLessons, getPrograms, type Program } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };

const demoPrograms: Program[] = [
  { id: 'demo-anxiety', title: 'Understanding Anxiety', description: 'Learn practical ways to understand stress, recognize patterns, and build healthy coping skills.', category: 'anxiety', difficulty_level: 'beginner', estimated_duration_days: 14, total_lessons: 3 },
  { id: 'demo-resilience', title: 'Building Resilience', description: 'Develop emotional resilience, problem-solving skills, and supportive connections.', category: 'stress', difficulty_level: 'intermediate', estimated_duration_days: 21, total_lessons: 2 },
  { id: 'demo-mood', title: 'Overcoming Low Mood', description: 'Explore evidence-informed habits that can support mood, routines, and self-compassion.', category: 'wellbeing', difficulty_level: 'intermediate', estimated_duration_days: 28, total_lessons: 2 },
];

export default function Programs({ onBack, onHome }: Props) {
  const [programs, setPrograms] = useState<Program[]>(demoPrograms);
  const [selected, setSelected] = useState<Program | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);

  useEffect(() => {
    getPrograms().then((data) => data.length && setPrograms(data)).catch(() => undefined);
  }, []);

  async function openProgram(program: Program) {
    setSelected(program);
    setLoadingLessons(true);
    try {
      const data = await getLessons(program.id);
      setLessons(data);
    } catch {
      setLessons([]);
    } finally {
      setLoadingLessons(false);
    }
  }

  return (
    <section className="workspace-shell">
      <header className="workspace-topbar">
        <button className="workspace-brand" onClick={onHome}><Brand compact /></button>
        <button className="text-link" onClick={onBack}>Back to dashboard</button>
      </header>
      <div className="workspace-content">
        <div className="workspace-heading"><div><span className="eyebrow">Learn at your pace</span><h1>Programs & lessons</h1><p>Evidence-informed educational content designed to support everyday wellbeing.</p></div></div>

        {selected ? (
          <section className="program-detail">
            <button className="text-link" onClick={() => setSelected(null)}>← All programs</button>
            <span className="program-category">{selected.category}</span>
            <h2>{selected.title}</h2>
            <p>{selected.description}</p>
            <div className="detail-meta"><span>{selected.difficulty_level}</span><span>{selected.estimated_duration_days ?? '—'} days</span><span>{selected.total_lessons ?? lessons.length} lessons</span></div>
            <div className="lesson-list">
              {(lessons.length ? lessons : Array.from({ length: selected.total_lessons ?? 0 }, (_, i) => ({ id: `demo-${i}`, lesson_number: i + 1, title: `Lesson ${i + 1}`, description: 'Lesson content will be available when the program data is connected.' }))).map((lesson) => (
                <article className="lesson-row" key={lesson.id}>
                  <span className="lesson-number">{lesson.lesson_number}</span>
                  <div><strong>{lesson.title}</strong><p>{lesson.description}</p></div>
                  <button className="outline-action">Open</button>
                </article>
              ))}
            </div>
            {loadingLessons && <p className="loading-copy">Loading lessons…</p>}
          </section>
        ) : (
          <div className="program-grid large">
            {programs.map((program) => (
              <article className="program-card" key={program.id}>
                <span className="program-category">{program.category}</span>
                <h3>{program.title}</h3>
                <p>{program.description}</p>
                <div className="program-meta"><span>{program.total_lessons ?? 0} lessons</span><span>{program.estimated_duration_days ?? '—'} days</span></div>
                <button className="primary-action" onClick={() => openProgram(program)}>View program</button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
