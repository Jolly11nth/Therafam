import { FormEvent, useEffect, useState } from 'react';
import { searchExternalSelfHelpResources, type ExternalSelfHelpResource } from '../lib/therafamApi';
import './ExternalSelfHelpResources.css';

const TOPIC_SUGGESTIONS = [
  'stress management',
  'anxiety',
  'sleep problems',
  'depression',
  'mindfulness',
];

export default function ExternalSelfHelpResources() {
  const [query, setQuery] = useState('stress management');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [results, setResults] = useState<ExternalSelfHelpResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  async function search(term = query, selectedLanguage = language) {
    const normalized = term.trim();
    if (normalized.length < 2) {
      setError('Enter at least two characters to search.');
      return;
    }

    setQuery(term);
    setLoading(true);
    setError('');
    try {
      const response = await searchExternalSelfHelpResources(normalized, selectedLanguage);
      setResults(response.results);
      setSearched(true);
    } catch (reason) {
      setResults([]);
      setSearched(true);
      setError(reason instanceof Error ? reason.message : 'Unable to retrieve resources right now.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void search('stress management', 'en');
    // Run once on mount to show useful starting resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(query, language);
  }

  return (
    <section className="external-resource-section" aria-labelledby="external-resource-heading">
      <div className="external-resource-heading">
        <div>
          <span className="eyebrow">More to explore</span>
          <h2 id="external-resource-heading">Free self-help reading</h2>
          <p>Find trustworthy health-topic articles from MedlinePlus to complement Therafam’s guided programs.</p>
        </div>
        <span className="external-resource-source">Free · No API key</span>
      </div>

      <form className="external-resource-search" onSubmit={submit}>
        <label className="sr-only" htmlFor="external-resource-query">Search health topics</label>
        <input
          id="external-resource-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try stress, anxiety, sleep…"
          maxLength={120}
          minLength={2}
        />
        <label className="sr-only" htmlFor="external-resource-language">Resource language</label>
        <select
          id="external-resource-language"
          value={language}
          onChange={(event) => {
            const nextLanguage = event.target.value as 'en' | 'es';
            setLanguage(nextLanguage);
            if (searched) void search(query, nextLanguage);
          }}
          aria-label="Resource language"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
        <button type="submit" className="primary-action" disabled={loading}>
          {loading ? 'Searching…' : 'Search resources'}
        </button>
      </form>

      <div className="external-resource-topics" aria-label="Suggested topics">
        <span>Try:</span>
        {TOPIC_SUGGESTIONS.map((topic) => (
          <button type="button" key={topic} onClick={() => void search(topic, language)} disabled={loading}>
            {topic}
          </button>
        ))}
      </div>

      {error && <p className="external-resource-error" role="alert">{error}</p>}
      {loading && <p className="external-resource-status" role="status">Looking for relevant health topics…</p>}
      {!loading && searched && !error && results.length === 0 && (
        <p className="external-resource-status">No matching articles were found. Try a broader topic, such as “stress” or “sleep”.</p>
      )}

      {results.length > 0 && (
        <div className="external-resource-grid">
          {results.map((resource) => (
            <article className="external-resource-card" key={resource.url}>
              <span className="external-resource-card-source">{resource.source}</span>
              <h3>{resource.title}</h3>
              {resource.summary && <p>{resource.summary}</p>}
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                Read on MedlinePlus <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      )}

      <p className="external-resource-disclaimer">
        Educational information only; it is not a diagnosis or a substitute for care from a qualified health professional.
        Content and links are provided by MedlinePlus.gov. MedlinePlus does not endorse Therafam.
      </p>
    </section>
  );
}
