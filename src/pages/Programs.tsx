import { T, translate } from '../lib/i18n';
import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import { completeLesson, getLessons, getProgramProgress, getPrograms, type Program } from '../lib/therafamApi';

type Props = { onBack: () => void; onHome: () => void };

type Lesson = { id: string; lesson_number: number; title: string; description?: string | null; content_text?: string | null };

export default function Programs({ onBack, onHome }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programLoading, setProgramLoading] = useState(true);
  const [programError, setProgramError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [progressSaving, setProgressSaving] = useState(false);
  const [selected, setSelected] = useState<Program | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(false);

  useEffect(() => {
    let active = true;
    getPrograms().then((data) => { if (active) setPrograms(data); })
      .catch((error) => { if (active) setProgramError(error instanceof Error ? error.message : 'Unable to load programs from the database.'); })
      .finally(() => { if (active) setProgramLoading(false); });
    return () => { active = false; };
  }, []);

  async function openProgram(program: Program) {
    setSelected(program);
    setSelectedLesson(null);
    setLessons([]);
    setCompletedLessons(new Set());
    setSaveError('');
    setLoadingLessons(true);
    try {
      const [data, progress] = await Promise.all([getLessons(program.id), getProgramProgress(program.id)]);
      setLessons(data as Lesson[]);
      setCompletedLessons(new Set(progress.filter((item) => item.status === 'completed').map((item) => item.lesson_id)));
    } catch (error) {
      setLessons([]);
      setSaveError(error instanceof Error ? error.message : 'Unable to load lessons or saved progress.');
    } finally {
      setLoadingLessons(false);
    }
  }

  async function markReviewed(lesson: Lesson) {
    if (!selected || completedLessons.has(lesson.id)) return;
    setProgressSaving(true);
    setSaveError('');
    try {
      await completeLesson(selected.id, lesson.id);
      setCompletedLessons((current) => new Set([...current, lesson.id]));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save lesson progress.');
    } finally {
      setProgressSaving(false);
    }
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
                <p><T>{selectedLesson.content_text || selectedLesson.description || 'This lesson has no published content yet.'}</T></p>
                <button className="primary-action" disabled={progressSaving || completedLessons.has(selectedLesson.id)} onClick={() => void markReviewed(selectedLesson)}><T>{completedLessons.has(selectedLesson.id) ? 'Completed' : progressSaving ? 'Saving…' : 'Mark as reviewed'}</T></button>{saveError && <p className="form-error"><T>{saveError}</T></p>}
              </article>
            ) : (
              <div className="lesson-list">
                {lessons.map((lesson) => (
                  <article className="lesson-row" key={lesson.id}>
                    <span className="lesson-number"><T>{lesson.lesson_number}</T></span>
                    <div><strong><T>{lesson.title}</T></strong><p><T>{lesson.description}</T></p></div>
                    <button className="outline-action" onClick={() => setSelectedLesson(lesson)}><T>Open</T></button>
                  </article>
                ))}
              </div>
            )}
            {loadingLessons && <p className="loading-copy"><T>Loading lessons…</T></p>}{!loadingLessons && !lessons.length && <div className="empty-state compact"><strong><T>No published lessons</T></strong><p><T>This program has no available lessons yet.</T></p></div>}{saveError && <p className="form-error"><T>{saveError}</T></p>}
          </section>
        ) : (
          <>
          {programError && <p className="form-error"><T>{programError}</T></p>{programLoading && <p className="loading-copy"><T>Loading programs…</T></p>}{!programLoading && !programError && programs.length === 0 && <div className="empty-state compact"><strong><T>No published programs</T></strong><p><T>Published self-help programs will appear here.</T></p></div>}<div className="program-grid large">
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
          </>
        )}
      </div>
    </section>
  );
}
