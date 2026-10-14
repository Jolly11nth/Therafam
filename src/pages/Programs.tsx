import { T, translate } from '../lib/i18n';
import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { getLessons, getPrograms, type Program } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };

type Lesson = { id: string; lesson_number: number; title: string; description?: string | null; content?: string | null };

const demoPrograms: Program[] = [
  { id: 'demo-anxiety', title: 'Understanding Anxiety', description: 'Learn practical ways to understand stress, recognize patterns, and build healthy coping skills.', category: 'anxiety', difficulty_level: 'beginner', estimated_duration_days: 14, total_lessons: 3 },
  { id: 'demo-resilience', title: 'Building Resilience', description: 'Develop emotional resilience, problem-solving skills, and supportive connections.', category: 'stress', difficulty_level: 'intermediate', estimated_duration_days: 21, total_lessons: 2 },
  { id: 'demo-mood', title: 'Overcoming Low Mood', description: 'Explore evidence-informed habits that can support mood, routines, and self-compassion.', category: 'wellbeing', difficulty_level: 'intermediate', estimated_duration_days: 28, total_lessons: 2 },
];

export default function Programs({ onBack, onHome }: Props) {
  const [programs, setPrograms] = useState<Program[]>(demoPrograms);
  const [selected, setSelected] = useState<Program | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(false);

  useEffect(() => {
    getPrograms().then((data) => data.length && setPrograms(data)).catch(() => undefined);
  }, []);

  async function openProgram(program: Program) {
    setSelected(program);
    setSelectedLesson(null);
    setLoadingLessons(true);
    try {
      const data = await getLessons(program.id);
      setLessons(data as Lesson[]);
    } catch {
      setLessons([]);
    } finally {
      setLoadingLessons(false);
    }
  }

  function getDisplayLessons(): Lesson[] {
    if (lessons.length) return lessons;
    return Array.from({ length: selected?.total_lessons ?? 0 }, (_, i) => ({
      id: `demo-${i}`,
      lesson_number: i + 1,
      title: `Lesson ${i + 1}`,
      description: 'This lesson will be available when the program content is connected.',
      content: 'Take a moment to reflect on the topic, write down one thing you learned, and choose one small action you can try today.',
    }));
  }

  return (
    <section className="workspace-shell">
      <header className="workspace-topbar">
        <button className="workspace-brand" onClick={onHome} aria-label={translate("Go home")}><Brand compact /></button>
        <button className="text-link" onClick={onBack}><T>Back to dashboard</T></button>
      </header>
      <div className="workspace-content">
        <div className="workspace-heading"><div><span className="eyebrow"><T>Learn at your pace</T></span><h1><T>Programs & lessons</T></h1><p><T>Evidence-informed educational content designed to support everyday wellbeing.</T></p></div></div>

        {selected ? (
          <section className="program-detail">
            <button className="text-link" onClick={() => { setSelected(null); setSelectedLesson(null); }}><T>← All programs</T></button>
            <span className="program-category"><T>{selected.category}</T></span>
            <h2><T>{selected.title}</T></h2>
            <p><T>{selected.description}</T></p>
            <div className="detail-meta"><span><T>{selected.difficulty_level}</T></span><span>{selected.estimated_duration_days ?? '—'} days</span><span>{selected.total_lessons ?? lessons.length} lessons</span></div>
            {selectedLesson ? (
              <article className="lesson-viewer">
                <button className="text-link" onClick={() => setSelectedLesson(null)}><T>← Back to lessons</T></button>
                <span className="lesson-number">Lesson {selectedLesson.lesson_number}</span>
                <h2><T>{selectedLesson.title}</T></h2>
                <p><T>{selectedLesson.content || selectedLesson.description || 'Lesson content will appear here when connected.'}</T></p>
                <button className="primary-action" onClick={() => setSelectedLesson(null)}><T>Mark as reviewed</T></button>
              </article>
            ) : (
              <div className="lesson-list">
                {getDisplayLessons().map((lesson) => (
                  <article className="lesson-row" key={lesson.id}>
                    <span className="lesson-number"><T>{lesson.lesson_number}</T></span>
                    <div><strong><T>{lesson.title}</T></strong><p><T>{lesson.description}</T></p></div>
                    <button className="outline-action" onClick={() => setSelectedLesson(lesson)}><T>Open</T></button>
                  </article>
                ))}
              </div>
            )}
            {loadingLessons && <p className="loading-copy"><T>Loading lessons…</T></p>}
          </section>
        ) : (
          <div className="program-grid large">
            {programs.map((program) => (
              <article className="program-card" key={program.id}>
                <span className="program-category"><T>{program.category}</T></span>
                <h3><T>{program.title}</T></h3>
                <p><T>{program.description}</T></p>
                <div className="program-meta"><span>{program.total_lessons ?? 0} lessons</span><span>{program.estimated_duration_days ?? '—'} days</span></div>
                <button className="primary-action" onClick={() => openProgram(program)}><T>View program</T></button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
