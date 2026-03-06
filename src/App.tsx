import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

function getORPIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 4) return 1;
  if (len <= 7) return 2;
  if (len <= 10) return 3;
  if (len <= 13) return 4;
  return 5;
}

function WordDisplay({ word }: { word: string }) {
  if (!word) return null;
  
  const cleanWord = word.replace(/[.,!?;:"'()\[\]{}]+$/, '').replace(/^["'()\[\]{}]+/, '');
  const orpIndex = getORPIndex(cleanWord || word);
  
  const match = word.match(/^["'()\[\]{}]+/);
  const startOffset = match ? match[0].length : 0;
  const actualOrpIndex = Math.min(startOffset + orpIndex, word.length - 1);
  
  const leftPart = word.substring(0, actualOrpIndex);
  const orpLetter = word.substring(actualOrpIndex, actualOrpIndex + 1);
  const rightPart = word.substring(actualOrpIndex + 1);

  return (
    <div className="flex items-center w-full text-5xl md:text-7xl font-sans font-medium tracking-tight">
      <div className="flex-1 text-right">{leftPart}</div>
      <div className="text-red-600">{orpLetter}</div>
      <div className="flex-1 text-left">{rightPart}</div>
    </div>
  );
}

export default function App() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'input' | 'reading'>('input');
  const [wpm, setWpm] = useState<number | string>(300);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  const parsedWords = useMemo(() => {
    const tokens = text.trim().split(/(\s+)/);
    const result = [];
    let isNextSentenceStart = true;
    
    for (let i = 0; i < tokens.length; i++) {
      if (i % 2 === 0) {
        if (tokens[i].length > 0) {
          result.push({
            text: tokens[i],
            hasParagraphBreakAfter: false,
            isSentenceStart: isNextSentenceStart,
          });
          const cleanWord = tokens[i].replace(/["'()\[\]{}]+$/, '');
          isNextSentenceStart = /[.!?]$/.test(cleanWord);
        }
      } else {
        if (tokens[i].includes('\n\n') || tokens[i].includes('\n\r\n')) {
          if (result.length > 0) {
            result[result.length - 1].hasParagraphBreakAfter = true;
          }
          isNextSentenceStart = true;
        }
      }
    }
    return result;
  }, [text]);

  const totalWords = parsedWords.length;
  const timeoutRef = useRef<number | null>(null);

  const handleRewind = useCallback(() => {
    setIsPlaying(false);
    setWordIndex(prev => {
      if (prev === 0) return 0;
      let targetIndex = prev;
      
      // If we are exactly at a sentence start, we want to find the ONE BEFORE IT.
      // If we are NOT at a sentence start, we want to find the CURRENT ONE'S START.
      if (parsedWords[prev]?.isSentenceStart) {
        targetIndex--;
      }
      
      while (targetIndex > 0 && !parsedWords[targetIndex]?.isSentenceStart) {
        targetIndex--;
      }
      
      return Math.max(0, targetIndex);
    });
  }, [parsedWords]);

  const play = useCallback(() => {
    if (wordIndex >= totalWords) {
      setIsPlaying(false);
      return;
    }

    const current = parsedWords[wordIndex];
    const prev = wordIndex > 0 ? parsedWords[wordIndex - 1] : null;
    const word = current.text;
    
    const currentWpm = typeof wpm === 'number' ? wpm : (Number(wpm) || 300);
    const baseInterval = 60000 / currentWpm;
    let delay = baseInterval;

    if (word) {
      // 1. Word length delay
      const cleanWordLength = word.replace(/[.,!?;:"'()\[\]{}]/g, '').length;
      if (cleanWordLength > 6) {
        delay += (cleanWordLength - 6) * (baseInterval * 0.15);
      }

      // 2. Punctuation-based delays
      if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
        delay += baseInterval * 1.5;
      } else if (word.endsWith(',') || word.endsWith(';') || word.endsWith(':')) {
        delay += baseInterval * 0.8;
      } else if (word.endsWith('"') || word.endsWith('”') || word.endsWith(')')) {
        delay += baseInterval * 0.2;
      }

      // 3. Parentheses and quotes pre-delay
      if (word.startsWith('"') || word.startsWith('“') || word.startsWith('(')) {
        delay += baseInterval * 0.2;
      }

      // 4. New thought buffer
      if (prev && (prev.text.endsWith('.') || prev.text.endsWith('!') || prev.text.endsWith('?'))) {
        delay += baseInterval * 0.5;
      }

      // 5. Paragraph breaks
      if (current.hasParagraphBreakAfter) {
        delay += baseInterval * 1.5;
      }
    }

    timeoutRef.current = window.setTimeout(() => {
      setWordIndex(prevIdx => {
        if (prevIdx + 1 >= totalWords) {
          setIsPlaying(false);
          return prevIdx;
        }
        return prevIdx + 1;
      });
    }, delay);
  }, [wordIndex, parsedWords, totalWords, wpm]);

  useEffect(() => {
    if (isPlaying) {
      play();
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isPlaying, play]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'reading') {
        if (e.code === 'Space') {
          e.preventDefault();
          setIsPlaying(p => !p);
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          handleRewind();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, handleRewind]);

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white flex flex-col">
      <div className="w-full max-w-3xl mx-auto p-6 md:p-12 flex-1 flex flex-col">
        <header className="mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">RSVP Reader</h1>
        </header>

        {mode === 'input' ? (
          <div className="flex-1 flex flex-col gap-6">
            <textarea
              className="flex-1 w-full border-2 border-black p-4 text-lg resize-none focus:outline-none focus:ring-0"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your text here..."
            />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <label className="font-bold uppercase tracking-tight">WPM</label>
                <input
                  type="number"
                  className="border-2 border-black p-2 w-24 focus:outline-none"
                  value={wpm}
                  onChange={e => setWpm(e.target.value)}
                  min={100}
                  max={2000}
                  step={10}
                />
              </div>
              <button
                className="w-full sm:w-auto border-2 border-black px-8 py-3 font-bold uppercase tracking-tight hover:bg-black hover:text-white transition-colors"
                onClick={() => {
                  if (totalWords > 0) {
                    let finalWpm = Number(wpm);
                    if (isNaN(finalWpm) || finalWpm < 10) finalWpm = 300;
                    setWpm(finalWpm);
                    setWordIndex(0);
                    setMode('reading');
                    setIsPlaying(true);
                  }
                }}
              >
                Read
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center gap-16">
            <div className="relative w-full h-48 flex items-center border-y-2 border-black">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black/20 -translate-x-1/2" />
              <div className="absolute left-1/2 top-0 w-2 h-2 bg-black -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute left-1/2 bottom-0 w-2 h-2 bg-black -translate-x-1/2 translate-y-1/2" />
              <WordDisplay word={parsedWords[wordIndex]?.text || ''} />
            </div>
            
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  className="flex-1 accent-black" 
                  min={0} 
                  max={Math.max(0, totalWords - 1)} 
                  value={wordIndex}
                  onChange={e => {
                    setWordIndex(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                />
                <span className="font-mono text-sm min-w-[80px] text-right">
                  {wordIndex + 1} / {totalWords}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <label className="font-bold uppercase text-sm tracking-tight">WPM</label>
                  <input
                    type="range"
                    className="accent-black flex-1 sm:w-32"
                    min={100}
                    max={1000}
                    step={10}
                    value={wpm}
                    onChange={e => setWpm(Number(e.target.value))}
                  />
                  <span className="font-mono text-sm w-10 text-right">{wpm}</span>
                </div>
                
                <div className="flex gap-4 w-full sm:w-auto">
                  <button
                    className="flex-1 sm:flex-none border-2 border-black px-6 py-2 font-bold uppercase text-sm tracking-tight hover:bg-black hover:text-white transition-colors"
                    onClick={handleRewind}
                    title="Previous Sentence (Left Arrow)"
                  >
                    Back
                  </button>
                  <button
                    className="flex-1 sm:flex-none border-2 border-black px-6 py-2 font-bold uppercase text-sm tracking-tight hover:bg-black hover:text-white transition-colors"
                    onClick={() => setIsPlaying(!isPlaying)}
                    title="Play/Pause (Space)"
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    className="flex-1 sm:flex-none border-2 border-black px-6 py-2 font-bold uppercase text-sm tracking-tight hover:bg-black hover:text-white transition-colors"
                    onClick={() => {
                      setIsPlaying(false);
                      setMode('input');
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
