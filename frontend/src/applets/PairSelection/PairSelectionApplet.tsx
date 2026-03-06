import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, Eye, Search, Info, ChevronDown, ChevronUp, Globe, Settings2, SlidersHorizontal, Plus, Minus } from 'lucide-react';

interface Chart {
  type: string;
  difficulty: string;
  level: string;
  internalLevel: string;
}

interface SongData {
  songId: string;
  title: string;
  artist: string;
  imageName: string;
  version?: string;
  releaseDate?: string;
  intl?: string | boolean;
  unavailable_usa?: boolean;
  charts: Chart[];
}

interface BracketDef {
  label: string;
  min: number;
  max: number;
  color: string;
}

interface PlayerSettings {
  activeBracket: string | null;
  minLevel: number;
  maxLevel: number;
  diffs: string[];
  rating: number;
}

const DEFAULT_BRACKETS: BracketDef[] = [
  { label: "< 10k", min: 1.0, max: 10.0, color: "default" },
  { label: "10k - 11k", min: 10.0, max: 11.5, color: "purple" },
  { label: "11k - 12k", min: 11.0, max: 12.5, color: "purple" },
  { label: "12k - 13k", min: 12.0, max: 13.4, color: "brown" },
  { label: "13k - 14k", min: 13.0, "max": 14.3, "color": "silver" },
  { label: "14k - 14.5k", min: 14.0, "max": 14.7, "color": "gold" },
  { label: "14.5k - 15k", min: 14.4, "max": 15.0, "color": "shiny-gold" },
  { label: "15k - 15.1k", min: 14.6, "max": 15.0, "color": "rainbow" },
  { label: "15.1k - 15.2k", min: 14.7, "max": 15.0, "color": "rainbow" },
  { label: "15.2k - 15.3k", min: 14.8, "max": 15.0, "color": "rainbow" },
  { label: "15.3k - 15.4k", "min": 14.8, "max": 15.0, "color": "rainbow" },
  { label: "15.4k - 15.5k", "min": 14.9, "max": 15.0, "color": "rainbow" },
  { label: "15.5k - 15.6k", "min": 14.9, "max": 15.0, "color": "rainbow" },
  { label: "15.6k - 15.7k", "min": 14.9, "max": 15.0, "color": "rainbow" },
  { "label": "15.7k - 15.8k", "min": 14.9, "max": 15.0, "color": "rainbow" },
  { "label": "15.8k - 15.9k", "min": 14.9, "max": 15.0, "color": "rainbow" },
  { "label": "15.9k - 16.0k", "min": 15.0, "max": 15.0, "color": "rainbow" },
  { "label": "16.0k - 16.1k", "min": 15.0, "max": 15.0, "color": "rainbow" },
  { "label": "16.1k - 16.2k", "min": 15.0, "max": 15.0, "color": "rainbow" }
];

interface ChartWithId extends Chart {
  id: string;
}

const GLOBAL_CSS = `
  /* Hide native spin buttons */
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type=number] {
    -moz-appearance: textfield;
  }

  /* Milestone Slider Styling */
  .milestone-slider {
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    background: #1e1b4b; /* bg-indigo-950 */
    border-radius: 5px;
    outline: none;
    transition: opacity .2s;
  }
  .milestone-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: #a855f7; /* purple-500 */
    cursor: pointer;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
  }
  .milestone-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: #a855f7;
    cursor: pointer;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
  }
`;

interface MatchedSongResult {
  song: SongData;
  type: 'DX' | 'STD';
  p1Charts: ChartWithId[];
  p2Charts: ChartWithId[];
  hiddenCount: number;
}

export default function PairSelectionApplet() {
  const [metadata, setMetadata] = useState<Record<string, SongData>>({});
  const [availableBrackets, setAvailableBrackets] = useState<BracketDef[]>(DEFAULT_BRACKETS);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Filters
  const [chartTypeFilter, setChartTypeFilter] = useState<string[]>(['DX', 'STD']);
  const [versionFilter, setVersionFilter] = useState<string[]>([]);
  const [availableVersions, setAvailableVersions] = useState<{label: string, value: string}[]>([]);
  const [resultsLimit, setResultsLimit] = useState(10);

  // New Phase 12 Filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [regionalFilter, setRegionalFilter] = useState<'US' | 'ALL'>('US');

  const [p1, setP1] = useState<PlayerSettings>({ 
    activeBracket: null, 
    minLevel: 13.0, 
    maxLevel: 14.5, 
    diffs: ['Expert', 'Master', 'Remaster'],
    rating: 14000
  });
  const [p2, setP2] = useState<PlayerSettings>({ 
    activeBracket: null, 
    minLevel: 12.0, 
    maxLevel: 13.5, 
    diffs: ['Expert', 'Master', 'Remaster'],
    rating: 13000
  });

  // Results State
  const [matchedSongs, setMatchedSongs] = useState<MatchedSongResult[]>([]);

  // Hidden Charts State
  const [hiddenCharts, setHiddenCharts] = useState<string[]>([]);
  const [showHiddenModal, setShowHiddenModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    // Load local storage
    try {
      const hGlobal = localStorage.getItem('maimai_hidden_global');
      if (hGlobal) setHiddenCharts(JSON.parse(hGlobal));
      // Migrate old data if it exists and clean it up
      const h1 = localStorage.getItem('maimai_hidden_p1');
      const h2 = localStorage.getItem('maimai_hidden_p2');
      if (!hGlobal && (h1 || h2)) {
         const merged = Array.from(new Set([...(h1 ? JSON.parse(h1) : []), ...(h2 ? JSON.parse(h2) : [])]));
         setHiddenCharts(merged);
         localStorage.removeItem('maimai_hidden_p1');
         localStorage.removeItem('maimai_hidden_p2');
      }
    } catch(e) { console.error(e); }

    // Fetch Brackets & Metadata sequentially
    const loadResources = async () => {
      try {
        // Safe Bracket Fetch
        try {
          const bRes = await fetch(`${import.meta.env.BASE_URL}brackets.json`);
          if (bRes.ok) {
            const bData = await bRes.json();
            setAvailableBrackets(bData);
          }
        } catch (err) {
            console.warn("Could not fetch brackets.json, using fallback.");
        }

        // Safe Versions Fetch
        let vDataForAutoSelect: {label: string, value: string}[] = [];
        try {
            const vRes = await fetch(`${import.meta.env.BASE_URL}versions.json`);
            if (vRes.ok) {
                const vData: {label: string, value: string}[] = await vRes.json();
                const filteredV = vData.filter(v => v.value !== 'All' && v.label !== 'All');
                setAvailableVersions(filteredV);
                vDataForAutoSelect = filteredV;
            }
        } catch (err) {
            console.warn("Could not fetch versions.json");
        }

        const res = await fetch(`${import.meta.env.BASE_URL}metadata.json`);
        if (!res.ok) throw new Error("Metadata Not Found");
        const data = await res.json();
        
        // Convert to array-like format by injecting imageName
        const processed: Record<string, SongData> = {};
        for (const [key, val] of Object.entries(data)) {
            processed[key] = { ...(val as any), imageName: key };
        }
        setMetadata(processed);

        // Pre-select all versions by default if versionFilter is empty
        // We use the functional update to avoid capturing stale versionFilter state
        setVersionFilter(prev => {
            if (prev.length === 0 && vDataForAutoSelect.length > 0) {
                return vDataForAutoSelect.map(v => v.value);
            }
            return prev;
        });
        
      } catch (e) {
        console.error(e);
        alert("Failed to load metadata DB.");
      } finally {
        setLoading(false);
      }
    };
    loadResources();
  }, []);

  // Save to local storage when changed
  useEffect(() => {
    localStorage.setItem('maimai_hidden_global', JSON.stringify(hiddenCharts));
  }, [hiddenCharts]);

  const toggleChartType = (type: string) => {
    setChartTypeFilter(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const executeSearch = () => {
    setSearching(true);
    // offload to next frame to allow UI re-render for loading state
    requestAnimationFrame(() => {
      let matches: MatchedSongResult[] = [];

      for (const song of Object.values(metadata)) {
        if (!song.charts) continue;
        // Apply version filter
        if (versionFilter.length > 0 && !versionFilter.includes(song.version || '')) {
            continue;
        }

        // Apply regional filter
        if (regionalFilter === 'US' && song.unavailable_usa === true) {
            continue;
        }

        const processType = (targetType: 'DX' | 'STD') => {
            const p1ValidCharts: ChartWithId[] = [];
            const p2ValidCharts: ChartWithId[] = [];
            let p1VisibleCount = 0;
            let p2VisibleCount = 0;
            let typeHiddenCountAtSearchTime = 0; 

            const relevantCharts = song.charts.filter(c => {
                const rawType = (c.type || '').toLowerCase();
                if (targetType === 'DX') return rawType.includes('dx');
                return rawType.includes('std') || rawType.includes('standard');
            });

            if (relevantCharts.length === 0) return;
            
            const isGloballyHiddenType = hiddenCharts.includes(`${song.songId}_${targetType}`);

            relevantCharts.forEach(c => {
               const internalLvl = parseFloat(c.internalLevel || c.level || '0');
               const cId = getChartId(song, c);
               const cWithId = { ...c, id: cId };
               const isHidden = hiddenCharts.includes(cId) || isGloballyHiddenType;
               
               let matchedP1 = false;
               let matchedP2 = false;

               // Check P1
               const p1DiffMatch = p1.diffs.length === 0 || p1.diffs.some(d => (c.difficulty || '').toLowerCase().includes(d.toLowerCase()));
               if (internalLvl >= p1.minLevel && internalLvl <= p1.maxLevel && p1DiffMatch) {
                 matchedP1 = true;
                 p1ValidCharts.push(cWithId); 
                 if (!isHidden) p1VisibleCount++;
               }

               // Check P2
               const p2DiffMatch = p2.diffs.length === 0 || p2.diffs.some(d => (c.difficulty || '').toLowerCase().includes(d.toLowerCase()));
               if (internalLvl >= p2.minLevel && internalLvl <= p2.maxLevel && p2DiffMatch) {
                 matchedP2 = true;
                 p2ValidCharts.push(cWithId); 
                 if (!isHidden) p2VisibleCount++;
               }
               
               if ((matchedP1 || matchedP2) && isHidden) {
                   typeHiddenCountAtSearchTime++;
               }
            });

            const p1Satisfied = p1VisibleCount > 0 || (p1VisibleCount === 0 && typeHiddenCountAtSearchTime > 0);
            const p2Satisfied = p2VisibleCount > 0 || (p2VisibleCount === 0 && typeHiddenCountAtSearchTime > 0);

            if (p1Satisfied && p2Satisfied && (p1VisibleCount > 0 || p2VisibleCount > 0 || typeHiddenCountAtSearchTime > 0)) {
                matches.push({ song, type: targetType, p1Charts: p1ValidCharts, p2Charts: p2ValidCharts, hiddenCount: typeHiddenCountAtSearchTime });
            }
        };

        if (chartTypeFilter.includes('DX')) processType('DX');
        if (chartTypeFilter.includes('STD')) processType('STD');
      }

      // Sort primarily by releaseDate descending, then by total chart matches
      matches.sort((a, b) => {
         const dA = a.song.releaseDate || '';
         const dB = b.song.releaseDate || '';
         if (dA !== dB) return dB.localeCompare(dA);
         
         return (b.p1Charts.length + b.p2Charts.length) - (a.p1Charts.length + a.p2Charts.length);
      });

      setMatchedSongs(matches);
      setSearching(false);
    });
  };

  const getChartId = (song: SongData, chart: Chart) => `${song.songId}_${chart.type}`;

  const toggleVersion = (ver: string) => {
      setVersionFilter(prev => {
          if (prev.includes(ver)) {
              return prev.filter(v => v !== ver);
          } else {
              return [...prev, ver];
          }
      });
  };

  const selectAllVersions = () => {
      setVersionFilter(availableVersions.map(v => v.value));
  };

  const selectNoVersions = () => {
      setVersionFilter([]);
  };

  const handleHide = (chartId: string) => {
    if (!hiddenCharts.includes(chartId)) setHiddenCharts([...hiddenCharts, chartId]);
  };

  const handleUnhideAllFilters = () => {
    setHiddenCharts([]);
    setTimeout(executeSearch, 0); // Re-run search
  };

  const handleHardReset = () => {
    if (confirm("Are you sure you want to permanently clear ALL hidden charts from all queries?")) {
      setHiddenCharts([]);
      localStorage.removeItem('maimai_hidden_global');
      localStorage.removeItem('maimai_hidden_p1'); // Clean legacy
      localStorage.removeItem('maimai_hidden_p2'); // Clean legacy
      // If we are showing results, re-evaluate without hidden flags
      if (matchedSongs.length > 0) executeSearch();
    }
  };

  const getDiffColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'basic': return 'bg-green-600 text-white';
      case 'advanced': return 'bg-yellow-500 text-black';
      case 'expert': return 'bg-red-500 text-white';
      case 'master': return 'bg-purple-600 text-white';
      case 'remaster': return 'bg-pink-400 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const getBracketCSS = (color: string, isActive: boolean) => {
      let base = "px-1 py-1.5 text-[10px] sm:text-xs font-bold rounded shadow-sm border transition-all duration-200 select-none cursor-pointer text-center w-full";
      let activeStyles = "";

      // Lighten colors significantly for easier reading on dark backgrounds
      switch (color) {
        case 'purple': activeStyles = "bg-purple-500 text-white border-purple-300"; break;
        case 'brown':  activeStyles = "bg-orange-600 text-white border-orange-400"; break;
        case 'silver': activeStyles = "bg-slate-300 text-slate-900 border-slate-100"; break;
        case 'gold':   activeStyles = "bg-yellow-400 text-yellow-900 border-yellow-200"; break;
        case 'shiny-gold': activeStyles = "bg-gradient-to-r from-yellow-100 via-yellow-300 to-yellow-100 text-yellow-900 border-yellow-50 shadow-[0_0_8px_rgba(253,224,71,0.8)]"; break;
        case 'rainbow': activeStyles = `bg-gradient-to-r from-red-400 via-green-400 to-blue-400 text-white border-transparent bg-[length:200%_auto]`; break;
        default: activeStyles = "bg-gray-400 text-gray-900 border-gray-300"; break;
      }

      // Add "dim on hover" logic instead of "brighten on hover"
      if (isActive) {
          return `${base} ${activeStyles} scale-105 shadow-md ring-2 ring-white/70 brightness-110`;
      } else {
          return `${base} ${activeStyles} opacity-80 hover:opacity-100 hover:brightness-90 hover:scale-100`;
      }
  };

  const toggleBracket = (playerNum: 1 | 2, b: BracketDef) => {
    const setState = playerNum === 1 ? setP1 : setP2;
    
    setState(prev => {
        if (prev.activeBracket === b.label) {
            return { ...prev, activeBracket: null };
        } else {
            // Update rating to match bracket start if possible
            let newRating = prev.rating;
            const parts = b.label.replace('<', '').split('-').map(p => parseFloat(p.trim().replace('k', '')));
            if (!isNaN(parts[0])) {
                newRating = Math.round(parts[0] * 1000);
            } else if (b.label === "0") {
                newRating = 0;
            }
            return { ...prev, activeBracket: b.label, minLevel: b.min, maxLevel: b.max, rating: newRating };
        }
    });
  };



  const toggleDiff = (playerNum: 1 | 2, d: string) => {
      const setState = playerNum === 1 ? setP1 : setP2;
      setState(prev => {
          const newDiffs = prev.diffs.includes(d) 
            ? prev.diffs.filter(x => x !== d) 
            : [...prev.diffs, d];
          return { ...prev, diffs: newDiffs };
      });
  };

  const handleRatingInput = (playerNum: 1 | 2, ratingStr: string) => {
      const val = parseInt(ratingStr) || 0;
      const setState = playerNum === 1 ? setP1 : setP2;
      
      const ratingInK = val / 1000;
      let bestB = availableBrackets[0];
      
      // Find the last bracket whose lower bound milestone is <= current rating
      availableBrackets.forEach(b => {
          const parts = b.label.replace('<', '').split('-').map(p => parseFloat(p.trim().replace('k', '')));
          const lower = parts[0];
          if (!isNaN(lower) && ratingInK >= lower) {
              bestB = b;
          }
      });

      setState(prev => ({ ...prev, rating: val, minLevel: bestB.min, maxLevel: bestB.max, activeBracket: bestB.label }));
  };

  const handleRatingStep = (playerNum: 1 | 2, direction: 'up' | 'down') => {
      const setState = playerNum === 1 ? setP1 : setP2;
      const pState = playerNum === 1 ? p1 : p2;
      
      // Heuristic to find current or nearest bracket index
      const ratingInK = pState.rating / 1000;
      let currentIdx = -1;
      
      // Find the best match bracket
      availableBrackets.forEach((b, i) => {
          const parts = b.label.replace('<', '').split('-').map(p => parseFloat(p.trim().replace('k', '')));
          const lower = parts[0];
          if (!isNaN(lower) && Math.abs(ratingInK - lower) < 0.05) {
              currentIdx = i;
          }
      });

      let nextIdx;
      if (direction === 'up') {
          nextIdx = currentIdx + 1;
          if (nextIdx >= availableBrackets.length) return;
      } else {
          // If we are at -1 (custom) or first bracket, or exactly at a bracket
          nextIdx = currentIdx - 1;
          if (nextIdx < -1) return;
      }

      if (nextIdx === -1) {
          setState(prev => ({...prev, activeBracket: 'ALL', minLevel: 9.0, maxLevel: 15.0, rating: 15000}));
      } else {
          toggleBracket(playerNum, availableBrackets[nextIdx]);
      }
  };

  const renderPlayerSettings = (num: 1 | 2, pState: PlayerSettings, setPState: React.Dispatch<React.SetStateAction<PlayerSettings>>) => (
    <div className={`p-4 rounded-2xl border ${num === 1 ? 'bg-blue-900/10 border-blue-800/50' : 'bg-rose-900/10 border-rose-800/50'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
             <h3 className={`text-lg font-bold flex items-center gap-2 ${num === 1 ? 'text-blue-400' : 'text-rose-400'}`}>
                <span className={`w-8 h-8 flex items-center justify-center rounded-lg ${num === 1 ? 'bg-blue-500/20' : 'bg-rose-500/20'}`}>{num}</span>
                <span>Player Setup</span>
             </h3>
             <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-gray-800 shadow-inner group-hover:border-purple-500/30 transition-colors">
                <button 
                    onClick={() => handleRatingStep(num, 'down')}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    title="Decrease by 100"
                >
                    <Minus size={14} />
                </button>
                <input 
                    type="number" 
                    min="0"
                    max="17000"
                    step="100"
                    placeholder="14500"
                    value={pState.rating || ''}
                    onChange={(e) => handleRatingInput(num, e.target.value)}
                    className={`w-16 bg-transparent border-none text-white text-base font-black p-0 focus:ring-0 text-center placeholder:text-gray-700 tabular-nums transition-opacity ${pState.activeBracket === 'ALL' ? 'opacity-30' : 'opacity-100'}`}
                />
                <button 
                    onClick={() => handleRatingStep(num, 'up')}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    title="Increase by 100"
                >
                    <Plus size={14} />
                </button>
             </div>
        </div>

        <div className="mb-4">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Rating Milestone</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${pState.activeBracket === 'ALL' ? 'bg-white text-black' : 'bg-purple-900/40 text-purple-300'}`}>
                        {pState.activeBracket || "Custom"}
                    </span>
                </div>
                
                <input 
                    type="range"
                    min="-1"
                    max={availableBrackets.length - 1}
                    step="1"
                    value={pState.activeBracket === 'ALL' ? -1 : availableBrackets.findIndex(b => b.label === pState.activeBracket)}
                    onChange={(e) => {
                        const idx = parseInt(e.target.value);
                        if (idx === -1) {
                            setPState(prev => ({...prev, activeBracket: 'ALL', minLevel: 9.0, maxLevel: 15.0, rating: 15000}));
                        } else {
                            toggleBracket(num, availableBrackets[idx]);
                        }
                    }}
                    className="milestone-slider my-2"
                />
                
                <div className="relative h-4 mt-1">
                    {[
                        { text: 'ALL', idx: -1, rating: null },
                        { text: '10k', idx: 0, rating: 10000 },
                        { text: '11k', idx: 2, rating: 11000 },
                        { text: '12k', idx: 3, rating: 12000 },
                        { text: '13k', idx: 4, rating: 13000 },
                        { text: '14k', idx: 5, rating: 14000 },
                        { text: '15k', idx: 7, rating: 15000 },
                        { text: '16k', idx: 17, rating: 16000 },
                    ].map((label, i) => {
                        const vmax = availableBrackets.length - 1;
                        const vmin = -1;
                        const pct = ((label.idx - vmin) / (vmax - vmin)) * 100;
                        const isActive = label.text === 'ALL' 
                            ? pState.activeBracket === 'ALL'
                            : pState.rating === label.rating && pState.activeBracket !== 'ALL';
                        
                        let transform = 'translateX(-50%)';
                        if (pct < 5) transform = 'translateX(0)';
                        if (pct > 95) transform = 'translateX(-100%)';
                        
                        return (
                            <span 
                                key={i}
                                className={`absolute text-[7px] sm:text-[8px] font-bold uppercase tracking-tighter transition-colors ${isActive ? 'text-white' : 'text-gray-600'}`}
                                style={{ left: `${pct}%`, transform }}
                            >
                                {label.text}
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>

        <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Difficulty Filter</span>
                <div className="flex flex-wrap justify-end gap-1 max-w-[150px] sm:max-w-none">
                    {['Basic', 'Advanced', 'Expert', 'Master', 'Remaster'].map(d => (
                        <button 
                            key={d}
                            onClick={() => toggleDiff(num, d)}
                            className={`px-2 py-0.5 text-[8px] font-black rounded uppercase border transition-all ${pState.diffs.includes(d) ? 'bg-gray-200 text-black border-white' : 'bg-gray-900 text-gray-600 border-gray-800 hover:text-gray-400'}`}
                        >
                            {d === 'Remaster' ? 'Re:M' : d.substring(0,3)}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-800 transition-colors group-hover:border-gray-700">
            <label className="flex justify-between text-[10px] mb-2 text-gray-500 font-black uppercase tracking-wider">
                <span>Internal Level {pState.activeBracket && pState.activeBracket !== 'ALL' && "(Auto)"}</span>
                <span className="text-gray-200 font-bold">{pState.minLevel.toFixed(1)} - {pState.maxLevel.toFixed(1)}</span>
            </label>
            <div className={`relative h-6`}>
                <style>{`
                    input[type=range].p-slider-${num}::-webkit-slider-thumb {
                        pointer-events: auto;
                        appearance: none;
                        width: 1rem;
                        height: 1rem;
                        border-radius: 9999px;
                        background-color: ${num === 1 ? '#3b82f6' : '#f43f5e'};
                    }
                    input[type=range].p-slider-${num}::-moz-range-thumb {
                        pointer-events: auto;
                        width: 1rem;
                        height: 1rem;
                        border-radius: 9999px;
                        border: none;
                        background-color: ${num === 1 ? '#3b82f6' : '#f43f5e'};
                    }
                `}</style>
                <input type="range" min="9" max="15" step="0.1" value={pState.minLevel} onChange={(e) => {
                    const val = Math.min(Number(e.target.value), pState.maxLevel);
                    setPState(s => ({...s, minLevel: val, activeBracket: 'ALL', rating: 15000}));
                }} className={`p-slider-${num} absolute w-full appearance-none bg-transparent z-20 cursor-pointer pointer-events-none`} />
                <input type="range" min="9" max="15" step="0.1" value={pState.maxLevel} onChange={(e) => {
                    const val = Math.max(Number(e.target.value), pState.minLevel);
                    setPState(s => ({...s, maxLevel: val, activeBracket: 'ALL', rating: 15000}));
                }} className={`p-slider-${num} absolute w-full appearance-none bg-transparent z-30 cursor-pointer pointer-events-none`} />
                
                <div className="absolute w-full h-1 bg-gray-800 rounded-full top-2 z-0"></div>
                <div className={`absolute h-1 rounded-full top-2 z-10 ${num === 1 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} style={{ left: `${((pState.minLevel - 9) / 6) * 100}%`, right: `${100 - ((pState.maxLevel - 9) / 6) * 100}%` }}></div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6 flex flex-col items-center">
      <style>{GLOBAL_CSS}</style>
      <header className="mb-6 flex flex-col items-center justify-between w-full max-w-6xl pt-4 relative">
        <Link to="/" className="text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap mb-2 sm:absolute sm:left-0 sm:top-1/2 sm:-translate-y-1/2 sm:mb-0 text-sm flex items-center gap-1">
          ← Portal Base
        </Link>
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 inline-block text-center flex-1">
          maimai <span className="italic font-light text-white">Pair Selector</span>
        </h1>
        <div className="hidden sm:block w-[100px]"></div>
      </header>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-xl font-bold text-gray-300">Loading Song Database...</h2>
        </div>
      ) : (
        <main className="w-full max-w-6xl flex flex-col gap-6">
          {/* HEADER SETTINGS */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 shadow-2xl">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {renderPlayerSettings(1, p1, setP1)}
                {renderPlayerSettings(2, p2, setP2)}
             </div>

             <div className="flex flex-col gap-2">
               {/* Advanced Collapsible Header */}
               <div className="border-t border-gray-800/50 mt-2">
                 <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 py-3 px-1 text-gray-500 hover:text-gray-300 transition-colors w-full group"
                 >
                    {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <span className="text-xs font-black uppercase tracking-[0.2em]">{showAdvanced ? 'Hide' : 'Show'} Advanced Filters</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-gray-800/80 to-transparent ml-2 opacity-30 group-hover:opacity-60"></div>
                 </button>
               </div>

               {showAdvanced && (
                 <div className="bg-gray-950/40 rounded-2xl p-5 border border-gray-800/60 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Regional & Type */}
                        <div className="space-y-6">
                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Globe size={12} /> Regional Version 
                                </span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setRegionalFilter('US')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all border ${regionalFilter === 'US' ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-gray-900 border-gray-800 text-gray-500'}`}
                                    >
                                        US / International
                                    </button>
                                    <button 
                                        onClick={() => setRegionalFilter('ALL')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all border ${regionalFilter === 'ALL' ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'bg-gray-900 border-gray-800 text-gray-500'}`}
                                    >
                                        All Regions (JP + Intl)
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Settings2 size={12} /> Chart Type
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={() => toggleChartType('DX')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors border ${chartTypeFilter.includes('DX') ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>DX</button>
                                    <button onClick={() => toggleChartType('STD')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors border ${chartTypeFilter.includes('STD') ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>Standard (STD)</button>
                                </div>
                            </div>
                        </div>

                        {/* Versions & Limits */}
                        <div className="space-y-6">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                        <SlidersHorizontal size={12} /> Release Version 
                                    </span>
                                    <div className="flex gap-3">
                                        <button onClick={selectAllVersions} className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase underline-offset-4 hover:underline">All</button>
                                        <button onClick={selectNoVersions} className="text-[10px] text-gray-500 hover:text-gray-400 font-bold uppercase underline-offset-4 hover:underline">None</button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                                    {availableVersions.map(v => (
                                        <button 
                                            key={v.value} 
                                            onClick={() => toggleVersion(v.value)}
                                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all border ${versionFilter.includes(v.value) ? 'bg-white/10 border-white/20 text-white' : 'bg-gray-900/50 border-gray-800 text-gray-600 hover:text-gray-400'}`}
                                        >
                                            {v.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-800 flex items-center gap-6">
                        <div className="flex items-center gap-4 flex-1">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Max Results</span>
                            <div className="flex-1 max-w-[300px] flex items-center gap-4">
                                <style>{`
                                    input[type=range].max-results-slider::-webkit-slider-thumb {
                                        appearance: none;
                                        width: 1rem;
                                        height: 1rem;
                                        border-radius: 9999px;
                                        background-color: #a855f7;
                                    }
                                    input[type=range].max-results-slider::-moz-range-thumb {
                                        width: 1rem;
                                        height: 1rem;
                                        border-radius: 9999px;
                                        border: none;
                                        background-color: #a855f7;
                                    }
                                `}</style>
                                <input 
                                    type="range" 
                                    min="5" max="45" step="5" 
                                    value={resultsLimit > 40 ? 45 : resultsLimit} 
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setResultsLimit(val > 40 ? 999999 : val);
                                    }} 
                                    className="max-results-slider flex-1 h-1 bg-gray-800 rounded-full appearance-none" 
                                />
                                <span className="text-xs font-black text-purple-400 min-w-[70px]">
                                    {resultsLimit > 40 ? 'UNBOUNDED' : resultsLimit}
                                </span>
                            </div>
                        </div>
                    </div>
                 </div>
               )}

               {/* Main Action Button */}
               <div className="mt-2 flex gap-4">
                   <button 
                        onClick={executeSearch}
                        disabled={searching}
                        className="flex-1 group relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_auto] hover:bg-[100%_center] text-white font-black py-4 px-8 rounded-2xl shadow-xl transition-all duration-500 disabled:opacity-50 uppercase tracking-[0.3em] text-sm"
                   >
                        <div className="flex items-center justify-center gap-3">
                            {searching ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Rebuilding Matrix...</span>
                                </>
                            ) : (
                                <>
                                    <Search size={18} className="group-hover:scale-110 transition-transform" />
                                    <span>Sync Compatible Charts</span>
                                </>
                            )}
                        </div>
                   </button>
                   
                   <button onClick={() => setShowInfoModal(true)} className="w-14 h-14 flex items-center justify-center bg-gray-900 border border-gray-800 rounded-2xl text-gray-500 hover:text-white transition-all">
                        <Info size={20} />
                   </button>
               </div>
               
               {/* Hidden Status */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-[10px] w-full bg-gray-950/30 p-4 rounded-2xl border border-gray-900 mt-2 font-black uppercase tracking-widest">
                 <div className="flex items-center gap-2 text-gray-600">
                    <EyeOff size={12} />
                    <span>{matchedSongs.filter(m => hiddenCharts.includes(`${m.song.songId}_${m.type}`)).length} results masked</span>
                 </div>
                 <div className="flex-1"></div>
                 {hiddenCharts.length > 0 && (
                   <button onClick={() => setShowHiddenModal(true)} className="text-gray-500 hover:text-white transition-colors underline decoration-dotted">Mange Masked</button>
                 )}
                 {hiddenCharts.length > 0 && (
                   <button onClick={handleUnhideAllFilters} className="text-white hover:text-purple-400 transition-colors">Reset Focus</button>
                 )}
                 {hiddenCharts.length > 0 && (
                   <button onClick={handleHardReset} className="text-red-900/50 hover:text-red-600 transition-all font-black" title="Explicit Global Clean">Force Flush</button>
                 )}
               </div>
             </div>
          </div>

          {/* RESULTS */}
          {matchedSongs.length > 0 && (
              <div className="mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                  <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm">{matchedSongs.length}</span>
                  Compatible Songs
                </h2>

                <div className="space-y-4">
                  {(() => {
                      let visibleIndex = 0;
                      return matchedSongs.map(({ song, type, p1Charts, p2Charts }) => {
                          const uid = `${song.songId}_${type}`;
                          const isGloballyHiddenType = hiddenCharts.includes(uid);
                          
                          // Calculate reactive hidden count based on current hiddenCharts state
                          const allMatchedChartsInThisCard = Array.from(new Set([...p1Charts, ...p2Charts].map(c => c.id)));
                          const reactiveHiddenCount = allMatchedChartsInThisCard.filter(id => hiddenCharts.includes(id)).length;

                          if (!isGloballyHiddenType) {
                              visibleIndex++;
                          }
                          
                          if (visibleIndex > resultsLimit && !isGloballyHiddenType) return null;

                          const renderChartRow = (c: ChartWithId, playerNum: 1 | 2) => (
                              <div key={`${c.difficulty}-${playerNum}`} className="flex items-center justify-between bg-gray-950/50 rounded overflow-hidden mt-1">
                                  <div className="flex items-center">
                                      <span className={`px-2 py-1 text-[10px] font-bold uppercase min-w-[30px] text-center ${playerNum === 1 ? 'bg-blue-900/50 text-blue-300' : 'bg-rose-900/50 text-rose-300'}`}>
                                          P{playerNum}
                                      </span>
                                      <span className={`${getDiffColor(c.difficulty || '')} px-2 py-1 text-[10px] font-bold uppercase min-w-[50px] text-center`}>
                                          {(c.difficulty || '').substring(0,3)}
                                      </span>
                                      <span className="px-2 text-xs font-mono font-medium">
                                          {parseFloat(c.internalLevel || c.level || '0').toFixed(1)}
                                      </span>
                                  </div>
                              </div>
                          );

                          if (isGloballyHiddenType) {
                              return (
                                  <div key={uid} className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-3 flex items-center justify-between group grayscale opacity-60 hover:opacity-90 hover:grayscale-0 transition-all">
                                      <div className="flex items-center gap-3 truncate">
                                          <EyeOff size={16} className="text-gray-500 shrink-0" />
                                          <div className="truncate">
                                              <div className="text-sm font-bold text-gray-300 truncate">{song.title}</div>
                                              <div className="text-[10px] text-gray-500 uppercase">{type} Variant • Hidden</div>
                                          </div>
                                      </div>
                                      <button 
                                          onClick={() => setHiddenCharts(prev => prev.filter(x => x !== uid))}
                                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-colors border border-gray-700"
                                      >
                                          Unhide
                                      </button>
                                  </div>
                              );
                          }

                          return (
                              <div key={uid} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col sm:flex-row shadow-lg relative group">
                                <div className="w-full sm:w-48 h-48 flex-shrink-0 bg-black relative">
                                  <img 
                                      src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover/${song.imageName}`} 
                                      onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/300?text=No+Image'}
                                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                      alt={song.title}
                                  />
                                  <div className="absolute top-2 left-2 z-10 transition-opacity">
                                      <button 
                                        onClick={() => handleHide(uid)} 
                                        className="w-10 h-10 bg-black/60 hover:bg-red-600 backdrop-blur-sm rounded-lg flex items-center justify-center text-white/50 hover:text-white border border-white/20 hover:border-red-400 transition-all shadow-lg"
                                        title={`Globally Hide ${type} variant for this song`}
                                      >
                                          &times;
                                      </button>
                                  </div>
                                  <div className={`absolute bottom-2 right-2 px-3 py-1 font-black text-sm rounded shadow-lg backdrop-blur-sm tracking-wider ${type === 'DX' ? 'bg-blue-600/80 text-white border border-blue-400/50' : 'bg-green-600/80 text-white border border-green-400/50'}`}>
                                      {type}
                                  </div>
                                </div>

                                <div className="flex-1 p-5 flex flex-col">
                                    <div className="mb-4 flex flex-col items-start justify-between">
                                      <div className="flex items-center justify-between w-full">
                                          <a href={`https://arcade-songs.zetaraku.dev/maimai/?title=${encodeURIComponent(song.title)}`} target="_blank" rel="noreferrer" className="text-xl font-bold leading-tight mb-1 hover:text-purple-400 hover:underline transition-colors flex items-center gap-2">
                                              {song.title} <span className="text-[10px] text-gray-500 whitespace-nowrap hidden sm:inline-block font-normal bg-gray-800 px-1.5 py-0.5 rounded leading-none border border-gray-700">↗ ZETARAKU</span>
                                          </a>
                                          
                                          {reactiveHiddenCount > 0 && !isGloballyHiddenType && (
                                              <div className="text-xs text-orange-400 bg-orange-900/20 px-2 py-1 rounded border border-orange-900/50 flex items-center gap-1.5 whitespace-nowrap">
                                                  <EyeOff size={12} /> {reactiveHiddenCount} Chart{reactiveHiddenCount > 1 ? 's' : ''} Omitted
                                              </div>
                                          )}
                                      </div>
                                      <p className="text-sm text-gray-400 line-clamp-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                          <span>{song.artist}</span>
                                          {song.releaseDate && <span className="text-gray-600 text-[10px] whitespace-nowrap">| {song.releaseDate}</span>}
                                          {song.version && <span className="text-purple-400/80 text-[9px] uppercase font-bold whitespace-nowrap tracking-wider bg-purple-900/30 px-1.5 py-0.5 rounded">[{song.version}]</span>}
                                      </p>
                                    </div>
                                    
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-3 flex flex-col">
                                          <h4 className="text-xs font-bold text-blue-400 mb-2 border-b border-blue-900/50 pb-1 uppercase tracking-wider flex justify-between items-center">
                                              <span>Player 1 Options</span>
                                              <span className="text-[10px] bg-blue-950 px-1.5 py-0.5 rounded">{p1Charts.filter(c => !hiddenCharts.includes(c.id)).length} Hits</span>
                                          </h4>
                                          <div className="flex flex-col gap-1">
                                              {p1Charts.filter(c => !hiddenCharts.includes(c.id)).length > 0 ? (
                                                   p1Charts.filter(c => !hiddenCharts.includes(c.id)).map(c => renderChartRow(c, 1))
                                              ) : (
                                                  <div className="flex-1 flex flex-col items-center justify-center text-center p-2 opacity-50">
                                                      <EyeOff size={16} className="text-blue-900 mb-1" />
                                                      <p className="text-xs font-medium">None active</p>
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                      
                                      <div className="bg-rose-900/10 border border-rose-900/30 rounded-xl p-3 flex flex-col">
                                          <h4 className="text-xs font-bold text-rose-400 mb-2 border-b border-rose-900/50 pb-1 uppercase tracking-wider flex justify-between items-center">
                                              <span>Player 2 Options</span>
                                              <span className="text-[10px] bg-rose-950 px-1.5 py-0.5 rounded">{p2Charts.filter(c => !hiddenCharts.includes(c.id)).length} Hits</span>
                                          </h4>
                                          <div className="flex flex-col gap-1">
                                              {p2Charts.filter(c => !hiddenCharts.includes(c.id)).length > 0 ? (
                                                   p2Charts.filter(c => !hiddenCharts.includes(c.id)).map(c => renderChartRow(c, 2))
                                              ) : (
                                                  <div className="flex-1 flex flex-col items-center justify-center text-center p-2 opacity-50">
                                                      <EyeOff size={16} className="text-rose-900 mb-1" />
                                                      <p className="text-xs font-medium">None active</p>
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                    </div>
                                </div>
                              </div>
                          );
                      });
                  })()}

                  {matchedSongs.length > resultsLimit && (
                    <div className="text-center text-gray-500 p-8 border border-dashed border-gray-800 rounded-2xl">
                        ...and {matchedSongs.length - resultsLimit} more matching songs truncated for performance. <br/> Try narrowing your internal level filters or increasing the Max Results count!
                    </div>
                  )}
                </div>
              </div>
          )}
        </main>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden mt-10 md:mt-0">
               <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-800">
                  <h3 className="text-xl font-bold flex items-center gap-2 text-white"><Info size={20} className="text-purple-400" /> Rating Level Mappings</h3>
                  <button onClick={() => setShowInfoModal(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
               </div>
               <div className="p-6">
                  <p className="text-sm text-gray-400 mb-4">
                      The "Select Rating Bracket" automatically constrains internal levels corresponding to maximum achievable base rating breakpoints using the standard DX maimai plates. Base values denote the general internal constants.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                     {availableBrackets.map(b => (
                         <div key={b.label} className="flex justify-between items-center bg-gray-950 border border-gray-800 p-2 rounded">
                            <span className={`font-bold ${getBracketCSS(b.color, true).split(' ').slice(-6).join(' ')} w-[80px] text-center block leading-loose shrink-0 scale-75 transform origin-left`}>{b.label}</span>
                            <span className="font-mono text-gray-400 whitespace-nowrap">{b.min} &rarr; {b.max}</span>
                         </div>
                     ))}
                  </div>

                  <p className="text-sm text-gray-400 mt-6 pt-4 border-t border-gray-800 text-center">
                     Want to update the bracket bounds directly? Modify `public/brackets.json` on the root repository.
                  </p>
                  
                  <div className="flex justify-end mt-4">
                      <button onClick={() => setShowInfoModal(false)} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-bold transition-colors">Close</button>
                  </div>
               </div>
            </div>
        </div>
      )}

      {/* Hidden Manager Modal */}
      {showHiddenModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
               <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-800 shrink-0">
                  <h3 className="text-xl font-bold flex items-center gap-2 text-white"><EyeOff size={20} className="text-red-400" /> Manage Hidden Charts</h3>
                  <button onClick={() => setShowHiddenModal(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
               </div>
               <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                  
                  {hiddenCharts.length === 0 ? (
                      <p className="text-center text-gray-500 my-10 italic">No charts currently hidden.</p>
                  ) : (
                      <div className="max-w-xl mx-auto">
                          <h4 className="text-gray-300 font-bold mb-3 border-b border-gray-800 pb-2 flex justify-between items-end">
                             Globally Hidden Entities
                             <span className="text-xs bg-red-900/50 text-red-200 px-2 py-0.5 rounded cursor-pointer hover:bg-red-800" onClick={() => setHiddenCharts([])}>Clear All</span>
                          </h4>
                          <div className="space-y-2">
                             {hiddenCharts.map(chartId => {
                                 const parts = chartId.split('_');
                                 const cType = parts.pop() || '';
                                 const cSong = parts.join('_');
                                 const songObj = Object.values(metadata).find(s => s.songId === cSong);
                                 
                                 return (
                                 <div key={chartId} className="flex justify-between items-center bg-gray-950/50 p-3 rounded border border-gray-800 text-sm">
                                     <div className="truncate pr-2">
                                         <div className="font-bold truncate text-gray-200">{songObj ? songObj.title : cSong}</div>
                                         <div className="text-[10px] text-gray-500 uppercase">{cType} Charts</div>
                                     </div>
                                     <button onClick={() => setHiddenCharts(prev => prev.filter(x => x !== chartId))} className="text-gray-400 hover:text-white shrink-0 bg-gray-800 p-2 rounded-md hover:bg-gray-700 transition-colors">
                                        <Eye size={14} />
                                     </button>
                                 </div>
                             )})}
                          </div>
                      </div>
                  )}

                  <div className="mt-8 flex justify-between items-end gap-4 shrink-0">
                      <p className="text-xs text-gray-500 italic max-w-sm">Changes here apply immediately to search parameters but require a fresh "Search" to fetch previously omitted songs.</p>
                      <button onClick={() => setShowHiddenModal(false)} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-bold transition-colors">Done</button>
                  </div>
               </div>
            </div>
        </div>
      )}
    </div>
  );
}
