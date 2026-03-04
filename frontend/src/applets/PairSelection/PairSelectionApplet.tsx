import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, Eye, Search, Info } from 'lucide-react';

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
  const [versionFilter, setVersionFilter] = useState<string[]>(['All']);
  const [availableVersions, setAvailableVersions] = useState<{label: string, value: string}[]>([]);
  const [resultsLimit, setResultsLimit] = useState(10);
  
  const [p1, setP1] = useState<PlayerSettings>({ activeBracket: null, minLevel: 13.0, maxLevel: 14.5 });
  const [p2, setP2] = useState<PlayerSettings>({ activeBracket: null, minLevel: 12.0, maxLevel: 13.5 });

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
        try {
            const vRes = await fetch(`${import.meta.env.BASE_URL}versions.json`);
            if (vRes.ok) {
                const vData = await vRes.json();
                setAvailableVersions(vData);
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
        
        // Exclude Japan-only songs
        if (String(song.intl) !== "1" && song.intl !== true && String(song.intl).toLowerCase() !== "true" && song.intl !== "Yes" && String(song.intl).toLowerCase() !== "true") {
            continue; 
        }
        
        // Exclude version non-matches
        if (!versionFilter.includes('All') && !versionFilter.includes(song.version || '')) {
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
               if (internalLvl >= p1.minLevel && internalLvl <= p1.maxLevel) {
                 matchedP1 = true;
                 p1ValidCharts.push(cWithId); 
                 if (!isHidden) p1VisibleCount++;
               }

               // Check P2
               if (internalLvl >= p2.minLevel && internalLvl <= p2.maxLevel) {
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
      if (ver === 'All') {
          setVersionFilter(['All']);
          return;
      }
      
      setVersionFilter(prev => {
          const next = prev.filter(v => v !== 'All');
          if (next.includes(ver)) {
              const without = next.filter(v => v !== ver);
              return without.length === 0 ? ['All'] : without;
          } else {
              return [...next, ver];
          }
      });
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
            return { activeBracket: b.label, minLevel: b.min, maxLevel: b.max };
        }
    });
  };

  const enableCustom = (playerNum: 1 | 2) => {
      const setState = playerNum === 1 ? setP1 : setP2;
      setState(prev => ({ ...prev, activeBracket: null }));
  };

  const renderPlayerSettings = (num: 1 | 2, pState: PlayerSettings, setPState: React.Dispatch<React.SetStateAction<PlayerSettings>>) => (
    <div className={`p-5 rounded-2xl border ${num === 1 ? 'bg-blue-900/10 border-blue-800/50' : 'bg-rose-900/10 border-rose-800/50'}`}>
        <h3 className={`text-xl font-bold mb-4 flex items-center justify-between gap-2 ${num === 1 ? 'text-blue-400' : 'text-rose-400'}`}>
            <span>Player {num} Setup</span>
            {pState.activeBracket && (
                <button onClick={() => enableCustom(num)} className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded hover:text-white border border-gray-700 hover:bg-gray-700">Clear</button>
            )}
        </h3>
        
        <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">Select Rating Bracket</label>
                <button onClick={() => setShowInfoModal(true)} className="text-gray-500 hover:text-white transition-colors">
                    <Info size={16} />
                </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
                {availableBrackets.map((b) => (
                    <button
                        key={b.label}
                        onClick={() => toggleBracket(num, b)}
                        className={getBracketCSS(b.color, pState.activeBracket === b.label)}
                        title={`Matches levels from ${b.min} to ${b.max}`}
                    >
                        {b.label}
                    </button>
                ))}
            </div>
            {!pState.activeBracket && <p className="text-xs text-gray-500 mt-2 italic">Custom Level Mode active. Use sliders natively below.</p>}
        </div>

        <div className="mb-2 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
            <label className="flex justify-between text-sm mb-1 text-gray-300">
                <span>Internal Level {pState.activeBracket && "(Locked to Bracket)"}</span>
                <span className="font-bold">{pState.minLevel.toFixed(1)} - {pState.maxLevel.toFixed(1)}</span>
            </label>
            <div className={`relative h-6 mt-3 ${pState.activeBracket ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <input type="range" min="0" max="15" step="0.1" value={pState.minLevel} onChange={(e) => {
                    const val = Math.min(Number(e.target.value), pState.maxLevel);
                    setPState(s => ({...s, minLevel: val, activeBracket: null}));
                }} className={`absolute w-full pointer-events-none appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 ${num === 1 ? '[&::-webkit-slider-thumb]:bg-blue-500' : '[&::-webkit-slider-thumb]:bg-rose-500'} [&::-webkit-slider-thumb]:rounded-full z-20`} />
                <input type="range" min="0" max="15" step="0.1" value={pState.maxLevel} onChange={(e) => {
                    const val = Math.max(Number(e.target.value), pState.minLevel);
                    setPState(s => ({...s, maxLevel: val, activeBracket: null}));
                }} className={`absolute w-full pointer-events-none appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 ${num === 1 ? '[&::-webkit-slider-thumb]:bg-blue-500' : '[&::-webkit-slider-thumb]:bg-rose-500'} [&::-webkit-slider-thumb]:rounded-full z-30`} />
                
                <div className="absolute w-full h-1.5 bg-gray-700/50 rounded-full top-1 z-0"></div>
                <div className={`absolute h-1.5 rounded-full top-1 z-10 ${num === 1 ? 'bg-blue-500' : 'bg-rose-500'}`} style={{ left: `${(pState.minLevel / 15) * 100}%`, right: `${100 - (pState.maxLevel / 15) * 100}%` }}></div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 flex flex-col items-center">
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
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {renderPlayerSettings(1, p1, setP1)}
                {renderPlayerSettings(2, p2, setP2)}
             </div>

             <div className="flex flex-col gap-4 mt-6">
               {/* Controls Row 1 - Content Selection */}
               <div className="flex flex-col md:flex-row items-start md:items-center gap-6 w-full pt-6 border-t border-gray-800">
                  <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Chart Type</span>
                      <div className="flex gap-2">
                        <button onClick={() => toggleChartType('DX')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${chartTypeFilter.includes('DX') ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>DX</button>
                        <button onClick={() => toggleChartType('STD')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${chartTypeFilter.includes('STD') ? 'bg-green-600 text-white shadow-md shadow-green-600/20' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>STD</button>
                      </div>
                  </div>
               </div>
               
               {/* Controls Row 2 - Version Grid */}
               <div className="flex flex-col gap-3 pt-6 border-t border-gray-800">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Versions</span>
                    <div className="flex flex-wrap gap-2">
                        {availableVersions.map(v => (
                            <button 
                                key={v.value} 
                                onClick={() => toggleVersion(v.value)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${versionFilter.includes(v.value) ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>
               </div>

               {/* Controls Row 3 - Results & Actions */}
               <div className="flex flex-col md:flex-row items-start md:items-center gap-6 w-full pt-4 border-t border-gray-800/50">
                  <div className="flex items-center gap-6 flex-1">
                      <span className="text-sm font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap flex items-center justify-between min-w-[120px]">
                         Max Results <span className="text-gray-200 ml-4">{resultsLimit}</span>
                      </span>
                      <input 
                         type="range" 
                         min="1" max="20" step="1" 
                         value={resultsLimit} 
                         onChange={(e) => setResultsLimit(Number(e.target.value))} 
                         className="w-full max-w-[150px] accent-purple-500" 
                      />
                  </div>

                  <div className="w-px h-8 bg-gray-800 hidden md:block"></div>

                  <button 
                    onClick={executeSearch}
                    disabled={searching}
                    className="w-full md:w-auto flex flex-col md:flex-row items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-2 px-6 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] transition-all disabled:opacity-50 text-sm"
                  >
                     {searching ? (
                         <>
                            <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                            Loading
                         </>
                     ) : (
                         <>
                            <Search size={16} />
                            Search
                         </>
                     )}
                  </button>
               </div>
               
               {/* Controls Row 3 - Hidden Status */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm w-full bg-gray-950/50 p-4 rounded-xl border border-gray-800">
                 <div className="flex items-center gap-2 text-gray-400">
                    <EyeOff size={16} />
                    <span>{matchedSongs.filter(m => hiddenCharts.includes(`${m.song.songId}_${m.type}`)).length} hidden results found</span>
                 </div>
                 <div className="flex-1"></div>
                 {hiddenCharts.length > 0 && (
                   <button onClick={() => setShowHiddenModal(true)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors underline decoration-dotted">
                     Manage Hidden
                   </button>
                 )}
                 {hiddenCharts.length > 0 && (
                   <button onClick={handleUnhideAllFilters} className="flex items-center gap-2 text-white bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg shadow-lg font-bold transition-colors">
                     Clear Active Focus
                   </button>
                 )}
                 {hiddenCharts.length > 0 && (
                   <button onClick={handleHardReset} className="flex items-center gap-2 text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg shadow-lg font-bold transition-colors" title="Explicit Global Clean">
                     Hard Reset All
                   </button>
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
                  {matchedSongs.slice(0, resultsLimit).map(({ song, type, p1Charts, p2Charts }) => {
                      const uid = `${song.songId}_${type}`;
                      
                      const isGloballyHiddenType = hiddenCharts.includes(uid);
                      
                      // Calculate reactive hidden count based on current hiddenCharts state
                      const allMatchedChartsInThisCard = Array.from(new Set([...p1Charts, ...p2Charts].map(c => c.id)));
                      const reactiveHiddenCount = allMatchedChartsInThisCard.filter(id => hiddenCharts.includes(id)).length;

                      const renderChartRow = (c: ChartWithId, playerNum: 1 | 2) => {
                          return (
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
                      };

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
                        {/* Img Column with Badges / Hide Action */}
                        <div className="w-full sm:w-48 h-48 flex-shrink-0 bg-black relative">
                          <img 
                              src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover/${song.imageName}`} 
                              onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/300?text=No+Image'}
                              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                              alt={song.title}
                          />
                          {/* Top Left Global Hide Box */}
                          <div className="absolute top-2 left-2 z-10 transition-opacity">
                              <button 
                                onClick={() => handleHide(uid)} 
                                className="w-10 h-10 bg-black/60 hover:bg-red-600 backdrop-blur-sm rounded-lg flex items-center justify-center text-white/50 hover:text-white border border-white/20 hover:border-red-400 transition-all shadow-lg"
                                title={`Globally Hide ${type} variant for this song`}
                              >
                                  &times;
                              </button>
                          </div>
                          
                          {/* Bottom Right Type Identifier */}
                          <div className={`absolute bottom-2 right-2 px-3 py-1 font-black text-sm rounded shadow-lg backdrop-blur-sm tracking-wider ${type === 'DX' ? 'bg-blue-600/80 text-white border border-blue-400/50' : 'bg-green-600/80 text-white border border-green-400/50'}`}>
                              {type}
                          </div>
                        </div>

                        {/* Content Column */}
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
                              {/* Player 1 Valid Difficulties Block */}
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
                              
                              {/* Player 2 Valid Difficulties Block */}
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
                  )
                  })}

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
                                 // Parse basic info from chartId (e.g., songId_DX)
                                 const parts = chartId.split('_');
                                 const cType = parts.pop() || '';
                                 const cSong = parts.join('_'); // Song ID might have underscores
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
