'use client';

import { useState } from 'react';
import { Citation, Language } from '@/types';
import { translations } from '@/i18n/translations';
import styles from './Chat.module.css';

/**
 * CitationCard - Source citation display
 * 
 * Responsibilities:
 * - Display source name, page, section
 * - Expandable/collapsible
 * - Link to original document
 */

interface CitationCardProps {
  citation: Citation;
  language: Language;
}

export function CitationCard({ citation, language }: CitationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = translations[language];

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleCopy = async () => {
    const citationText = [
      citation.source,
      citation.page && `${language === 'am' ? 'ገጽ' : 'Page'} ${citation.page}`,
      citation.section && `${language === 'am' ? 'ክፍል' : 'Section'}: ${citation.section}`,
    ]
      .filter(Boolean)
      .join(', ');

    await navigator.clipboard.writeText(citationText);
  };

  return (
    <div className={styles.citationCard}>
      <button
        onClick={handleToggle}
        className={styles.citationToggle}
        aria-expanded={isExpanded}
        aria-controls="citation-details"
        type="button"
      >
        📖 {language === 'am' ? 'ምንጭ' : 'Source'}: {citation.source}
        <span className={styles.citationChevron}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {isExpanded && (
        <div id="citation-details" className={styles.citationDetails}>
          {citation.page && (
            <p>
              <strong>{language === 'am' ? 'ገጽ' : 'Page'}:</strong> {citation.page}
            </p>
          )}

          {citation.section && (
            <p>
              <strong>{language === 'am' ? 'ክፍል' : 'Section'}:</strong> {citation.section}
            </p>
          )}

          {citation.snippet && (
            <blockquote className={styles.citationSnippet}>
              "{citation.snippet}"
            </blockquote>
          )}

          <div className={styles.citationActions}>
            {citation.url && (
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.citationLink}
              >
                {language === 'am' ? 'ምንጩን ይመልከቱ' : 'View Source'} ↗
              </a>
            )}

            <button
              onClick={handleCopy}
              className={styles.citationCopyButton}
              type="button"
            >
              📋 {language === 'am' ? 'ቅዳ' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
