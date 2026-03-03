import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { 
  ImageIcon, Copy, RefreshCw, 
  ZoomIn, ZoomOut, Move, Crop as CropIcon 
} from 'lucide-react';

// Define TS Interfaces
interface MatchResult {
  imageName: string;
  score: number;
  songId?: string;
  title?: string;
  artist?: string;
  version?: string;
  releaseDate?: string;
  charts?: any[];
}

interface FeatureCache {
  objUrl: string | null;
  maxSize: number | null;
  maxFeatures: number | null;
  queryDesc: any; // cv.Mat
  metrics: string;
}

export default function ImageSearchApplet() {
  const [dbLoaded, setDbLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  
  // Settings state
  const [threshold, setThreshold] = useState(30);
  const [maxSize, setMaxSize] = useState(400);
  const [maxFeatures, setMaxFeatures] = useState(100);
  const [resultsCount, setResultsCount] = useState(5);
  const [minLevel, setMinLevel] = useState(0.0);
  const [maxLevel, setMaxLevel] = useState(15.0);
  const [difficultyFilter, setDifficultyFilter] = useState<string[]>(['All']);
  const [chartTypeFilter, setChartTypeFilter] = useState<string[]>(['DX', 'STD']);

  // App state
  const [queryImageFile, setQueryImageFile] = useState<File | Blob | null>(null);
  const [queryImageUrl, setQueryImageUrl] = useState<string | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [metrics, setMetrics] = useState('');
  
  const cropperRef = useRef<ReactCropperElement>(null);

  // Local Matcher State
  const [cvReady, setCvReady] = useState(false);
  const localDbRef = useRef<any>(null);
  const localMetadataRef = useRef<any>(null);
  const localCvOrbRef = useRef<any>(null);
  const localCvBfRef = useRef<any>(null);
  const featureCacheRef = useRef<FeatureCache>({ objUrl: null, maxSize: null, maxFeatures: null, queryDesc: null, metrics: '' });
  const searchCancelledRef = useRef(false);

  useEffect(() => {
    const checkCv = setInterval(() => {
      // @ts-ignore
      if (window.cv && window.cvReady) {
        clearInterval(checkCv);
        setCvReady(true);
      }
    }, 500);
    return () => clearInterval(checkCv);
  }, []);

  useEffect(() => {
    if (cvReady && !dbLoaded && !loading) {
      loadLocalDB();
    }
  }, [cvReady, dbLoaded, loading]);

  const loadLocalDB = async () => {
    setLoading(true);
    setProgressMsg("Downloading Database (~70MB)...");
    try {
      // @ts-ignore
      const cv = window.cv;
      const [dbRes, metaRes] = await Promise.all([
        fetch(`${import.meta.env.BASE_URL}sift_db.json`),
        fetch(`${import.meta.env.BASE_URL}metadata.json`)
      ]);
      if (!dbRes.ok || !metaRes.ok) throw new Error("Metadata Not Found - Are you running on GitHub Pages?");
      
      const dbText = await dbRes.text();
      const metaText = await metaRes.text();
      
      localDbRef.current = JSON.parse(dbText);
      localMetadataRef.current = JSON.parse(metaText);
      
      localCvOrbRef.current = new cv.ORB(1000);
      localCvBfRef.current = new cv.BFMatcher(cv.NORM_HAMMING, false);
      
      setDbLoaded(true);
    } catch (e) {
      console.error(e);
      alert("Failed to load local metadata DB.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      loadFile(e.target.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) loadFile(file);
        break;
      }
    }
  };

  const loadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setQueryImageFile(file);
    setQueryImageUrl(url);
    setResults([]);
    setMetrics('');
  };

  const clearFeatureCache = () => {
    if (featureCacheRef.current.queryDesc) {
      try { featureCacheRef.current.queryDesc.delete(); } catch(e) {}
      featureCacheRef.current.queryDesc = null;
    }
    featureCacheRef.current.objUrl = null;
  };

  const handleSearchCropped = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    cropper.getCroppedCanvas().toBlob((blob: Blob | null) => {
      if (blob) performSearch(blob, URL.createObjectURL(blob));
    });
  };

  const handleSearchFull = () => {
    if (queryImageFile && queryImageUrl) performSearch(queryImageFile, queryImageUrl);
  };

  const performSearch = async (image: Blob | File, objUrl: string) => {
    setLoading(true);
    setResults([]);
    searchCancelledRef.current = false;
    await searchLocal(image, objUrl);
  };

  const searchLocal = async (_file: Blob | File, objUrl: string) => {
    // @ts-ignore
    if (!window.cv || !localDbRef.current) {
      alert("Local environment not fully loaded.");
      setLoading(false);
      return;
    }
    // @ts-ignore
    const cv = window.cv;

    // Check Cache
    if (objUrl === featureCacheRef.current.objUrl && 
        maxSize === featureCacheRef.current.maxSize && 
        maxFeatures === featureCacheRef.current.maxFeatures && 
        featureCacheRef.current.queryDesc) {
      setMetrics(featureCacheRef.current.metrics);
      runMatchingLoop(featureCacheRef.current.queryDesc);
      return;
    }

    setProgressMsg("Loading image & extracting features...");
    const imgElement = new Image();
    imgElement.src = objUrl;
    imgElement.onload = () => {
      setTimeout(() => {
        try {
          const srcRaw = cv.imread(imgElement);
          const src = new cv.Mat();
          let currentMetrics = "";

          if (srcRaw.cols > maxSize || srcRaw.rows > maxSize) {
            let scale = maxSize / Math.max(srcRaw.cols, srcRaw.rows);
            let dsize = new cv.Size(Math.round(srcRaw.cols * scale), Math.round(srcRaw.rows * scale));
            cv.resize(srcRaw, src, dsize, 0, 0, cv.INTER_AREA);
            currentMetrics = `Source Dimension: ${srcRaw.cols}x${srcRaw.rows}\nExtraction Dimension: ${dsize.width}x${dsize.height}`;
          } else {
            srcRaw.copyTo(src);
            currentMetrics = `Source Dimension: ${srcRaw.cols}x${srcRaw.rows}\nExtraction Dimension: ${src.cols}x${src.rows}`;
          }
          
          const gray = new cv.Mat();
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

          if (!localCvOrbRef.current || localCvOrbRef.current.maxFeatures !== maxFeatures) {
            if (localCvOrbRef.current) try { localCvOrbRef.current.delete(); } catch(e) {}
            localCvOrbRef.current = new cv.ORB(maxFeatures);
          }

          const keypoints = new cv.KeyPointVector();
          const queryDesc = new cv.Mat();
          localCvOrbRef.current.detectAndCompute(gray, new cv.Mat(), keypoints, queryDesc);

          currentMetrics += `\nExtracted ORB Features: ${keypoints.size()}`;
          setMetrics(currentMetrics);

          src.delete(); gray.delete(); keypoints.delete(); srcRaw.delete();

          if (queryDesc.empty()) {
            queryDesc.delete();
            setLoading(false);
            return;
          }

          clearFeatureCache();
          featureCacheRef.current = {
            objUrl, maxSize, maxFeatures, queryDesc, metrics: currentMetrics
          };

          runMatchingLoop(queryDesc);
        } catch (e) {
          console.error(e);
          setLoading(false);
        }
      }, 50);
    };
  };

  const runMatchingLoop = (queryDesc: any) => {
    // @ts-ignore
    const cv = window.cv;
    const dbKeys = Object.keys(localDbRef.current);
    let currentIndex = 0;
    const batchSize = 100;
    const matchThreshold = 1.0 - (threshold / 100);
    const b64ToUint8Array = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    
    let currentResults: MatchResult[] = [];

    const processBatch = () => {
      try {
        if (searchCancelledRef.current) {
          setLoading(false);
          return;
        }

        let end = Math.min(currentIndex + batchSize, dbKeys.length);
        for (let i = currentIndex; i < end; i++) {
          let key = dbKeys[i];
          let meta = localMetadataRef.current[key];
          
          if (meta && meta.charts) {
            let match_range = meta.charts.some((c: any) => {
              let lvl = parseFloat(c.internalLevel || c.level || 0);
              let diffMatch = difficultyFilter.includes('All') || difficultyFilter.some(d => d.toLowerCase().replace(':', '') === (c.difficulty || '').toLowerCase().replace(':', ''));
              let rawType = (c.type || '').toLowerCase();
              let typeMatch = (chartTypeFilter.includes('DX') && rawType.includes('dx')) || 
                              (chartTypeFilter.includes('STD') && (rawType.includes('std') || rawType.includes('standard')));
              return lvl >= minLevel && lvl <= maxLevel && diffMatch && typeMatch;
            });
            if (!match_range) continue;
          }

          let val = localDbRef.current[key];
          let arr = b64ToUint8Array(val.data);
          let dbMat = cv.matFromArray(val.rows, 32, cv.CV_8U, arr);

          let matches = new cv.DMatchVectorVector();
          localCvBfRef.current.knnMatch(queryDesc, dbMat, matches, 2);

          let good = 0;
          for (let j = 0; j < matches.size(); j++) {
            let match = matches.get(j);
            if (match.size() === 2) {
              if (match.get(0).distance < matchThreshold * match.get(1).distance) good++;
            }
          }

          if (good > 0) currentResults.push({ imageName: key, score: good });
          dbMat.delete();
          matches.delete();
        }

        currentIndex = end;
        setProgressMsg(`Matched ${currentIndex} / ${dbKeys.length}`);

        if (currentIndex < dbKeys.length) {
          requestAnimationFrame(processBatch);
        } else {
          currentResults.sort((a, b) => b.score - a.score);
          let topK = currentResults.slice(0, resultsCount);

          topK.forEach(r => {
            let meta = localMetadataRef.current[r.imageName];
            if (meta) {
              r.songId = meta.songId;
              r.title = meta.title;
              r.artist = meta.artist;
              r.version = meta.version;
              r.charts = meta.charts;
              r.releaseDate = meta.releaseDate;
            }
          });

          setResults(topK);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    requestAnimationFrame(processBatch);
  };

  const toggleDifficulty = (diff: string) => {
    if (diff === 'All') {
      setDifficultyFilter(['All']);
    } else {
      setDifficultyFilter(prev => {
        const withoutAll = prev.filter(d => d !== 'All');
        if (withoutAll.includes(diff)) {
          const next = withoutAll.filter(d => d !== diff);
          return next.length === 0 ? ['All'] : next;
        } else {
          return [...withoutAll, diff];
        }
      });
    }
  };

  const toggleChartType = (type: string) => {
    setChartTypeFilter(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // prevent entirely emptying
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleCopy = (title: string) => {
    navigator.clipboard.writeText(title);
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 flex flex-col items-center" onPaste={handlePaste}>
      <header className="mb-4 text-center w-full max-w-5xl pt-4 relative">
        <Link to="/" className="absolute left-0 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-300 font-medium hidden md:block">
          ← Portal Base
        </Link>
        <h1 className="text-3xl shadow-blue-500 font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-pink-500 inline-block">
          maimai <span className="italic font-light">Reverse Image Search</span>
        </h1>
      </header>

      <main className="w-full max-w-5xl flex flex-col gap-6 relative">
        {(!cvReady || !dbLoaded) && (
          <div className="absolute inset-0 z-50 bg-gray-900/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center border border-gray-700 min-h-[400px]">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-pink-500 mb-2 text-center">
              Initializing Local Environment
            </h2>
            <p className="text-gray-300 text-lg text-center px-4">{!cvReady ? "Loading OpenCV WebAssembly..." : progressMsg}</p>
          </div>
        )}
        
        {/* TOP ROW: SETTINGS + CROPPER */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* SETTINGS PANEL (LEFT) */}
          <aside className="w-full md:w-1/3 bg-gray-800 rounded-2xl p-6 border border-gray-700 flex flex-col gap-5">
            <h2 className="text-xl font-bold border-b border-gray-700 pb-2">Settings</h2>
            
            <div>
              <label className="flex justify-between text-sm mb-1 text-gray-300">
                <span>Match Strictness (Lowe's)</span>
                <span>{(threshold/100).toFixed(2)}</span>
              </label>
              <input type="range" min="1" max="100" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-blue-500" />
              <div className="flex justify-between text-xs text-gray-500 mt-1"><span>Lenient</span><span>Strict</span></div>
            </div>

            <div>
              <label className="flex justify-between text-sm mb-1 text-gray-300">
                <span>Max Image Size</span>
                <span>{maxSize}px</span>
              </label>
              <input type="range" min="100" max="800" step="50" value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} className="w-full accent-blue-500" />
              <div className="flex justify-between text-xs text-gray-500 mt-1"><span>Fast</span><span>Detailed</span></div>
            </div>

            <div>
              <label className="flex justify-between text-sm mb-1 text-gray-300">
                <span>Max ORB Features</span>
                <span>{maxFeatures}</span>
              </label>
              <input type="range" min="5" max="1000" step="5" value={maxFeatures} onChange={(e) => setMaxFeatures(Number(e.target.value))} className="w-full accent-blue-500" />
              <div className="flex justify-between text-xs text-gray-500 mt-1"><span>Fast</span><span>Detailed</span></div>
            </div>

            <div>
              <label className="flex justify-between text-sm mb-1 text-gray-300">
                <span>Results Count</span>
                <span>{resultsCount}</span>
              </label>
              <input type="range" min="1" max="20" value={resultsCount} onChange={(e) => setResultsCount(Number(e.target.value))} className="w-full accent-blue-500" />
            </div>

            <div className="border-t border-gray-700 pt-3 mt-1">
              <label className="flex justify-between text-sm mb-1 text-gray-300">
                <span>Internal Level Filter</span>
                <span>{minLevel.toFixed(1)} - {maxLevel.toFixed(1)}</span>
              </label>
              
              <div className="relative h-6 mt-3">
                <input type="range" min="0" max="15" step="0.1" value={minLevel} onChange={(e) => setMinLevel(Math.min(Number(e.target.value), maxLevel))} className="absolute w-full pointer-events-none appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full z-20" />
                <input type="range" min="0" max="15" step="0.1" value={maxLevel} onChange={(e) => setMaxLevel(Math.max(Number(e.target.value), minLevel))} className="absolute w-full pointer-events-none appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full z-30" />
                <div className="absolute w-full h-1.5 bg-gray-700 rounded-full top-1 z-0"></div>
                <div className="absolute h-1.5 bg-blue-500 rounded-full top-1 z-10" style={{ left: `${(minLevel / 15) * 100}%`, right: `${100 - (maxLevel / 15) * 100}%` }}></div>
              </div>

              <div className="mt-4">
                <span className="text-xs text-gray-400 mb-2 block">Difficulty:</span>
                <div className="flex flex-wrap gap-1">
                  {['All', 'Basic', 'Advanced', 'Expert', 'Master', 'Re:MASTER'].map(diff => (
                    <button 
                      key={diff} 
                      onClick={() => toggleDifficulty(diff)}
                      className={`px-2 py-1 text-xs font-bold rounded shadow-inner border transition-colors ${
                        difficultyFilter.includes(diff)
                          ? 'bg-blue-600 border-blue-400 text-white' 
                          : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <span className="text-xs text-gray-400 mb-2 block">Chart Type:</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => toggleChartType('DX')}
                    className={`px-3 py-1.5 text-xs font-bold rounded shadow-inner border transition-colors ${
                      chartTypeFilter.includes('DX')
                        ? 'bg-blue-600 border-blue-400 text-white' 
                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    DX
                  </button>
                  <button 
                    onClick={() => toggleChartType('STD')}
                    className={`px-3 py-1.5 text-xs font-bold rounded shadow-inner border transition-colors ${
                      chartTypeFilter.includes('STD')
                        ? 'bg-green-600 border-green-400 text-white' 
                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    STD
                  </button>
                </div>
              </div>
            </div>

          </aside>

          {/* CROPPER AREA (RIGHT) */}
          <div className="w-full md:w-2/3 flex flex-col gap-6">
            {!queryImageUrl ? (
              <div 
                className="border-2 border-dashed border-gray-600 rounded-2xl p-16 text-center cursor-pointer hover:border-blue-500 hover:bg-gray-800 transition-all flex flex-col items-center justify-center h-full min-h-[400px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input type="file" id="file-input" className="hidden" accept="image/*" onChange={handleFileInput} />
                <ImageIcon className="h-16 w-16 text-blue-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Click to Upload or Drag & Drop</h2>
                <p className="text-gray-400">You can also paste (Ctrl+V) a screenshot directly</p>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    Query Image
                    {cvReady && dbLoaded && (
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" title="Environment Ready"></div>
                    )}
                  </h3>
                </div>
                <p className="text-gray-400 mb-4 text-sm">Use the controls below to zoom, pan, or draw a new crop box.</p>
                
                <div className="w-full flex-grow max-h-[500px] min-h-[300px] bg-black rounded-lg overflow-hidden mb-4 border border-gray-700">
                  <Cropper
                    ref={cropperRef}
                    src={queryImageUrl}
                    style={{ height: "100%", width: "100%" }}
                    viewMode={1}
                    dragMode="crop"
                    autoCropArea={0.8}
                    guides={true}
                    background={true}
                    toggleDragModeOnDblclick={true}
                    zoomOnWheel={false}
                  />
                </div>

                <div className="flex gap-2 justify-center mb-6 flex-wrap">
                  <button onClick={() => cropperRef.current?.cropper.zoom(0.1)} title="Zoom In" className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"><ZoomIn size={20}/></button>
                  <button onClick={() => cropperRef.current?.cropper.zoom(-0.1)} title="Zoom Out" className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"><ZoomOut size={20}/></button>
                  <button onClick={() => cropperRef.current?.cropper.setDragMode('move')} title="Pan Image" className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"><Move size={20}/></button>
                  <button onClick={() => cropperRef.current?.cropper.setDragMode('crop')} title="Draw Crop Box" className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"><CropIcon size={20}/></button>
                </div>

                {metrics && <pre className="text-xs text-gray-400 mb-6 bg-gray-900 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">{metrics}</pre>}

                <div className="flex gap-4 justify-center flex-wrap">
                  <button onClick={handleSearchCropped} disabled={loading} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl disabled:opacity-50 transition-colors">
                    Search Cropped Area
                  </button>
                  <button onClick={handleSearchFull} disabled={loading} className="px-6 py-3 border border-gray-600 hover:bg-gray-700 font-bold rounded-xl disabled:opacity-50 transition-colors">
                    Search Full Image
                  </button>
                  <button 
                    onClick={() => { setQueryImageUrl(null); setQueryImageFile(null); setResults([]); }} 
                    disabled={loading} 
                    className="flex items-center justify-center px-4 py-3 bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 border border-red-900/50 font-bold rounded-xl transition-colors"
                    title="Clear Image"
                  >
                    <RefreshCw size={20}/>
                  </button>
                </div>

                {loading && (
                  <div className="mt-6 flex flex-col items-center justify-center gap-3">
                    <div className="flex items-center gap-3 text-blue-400 font-medium">
                      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>{progressMsg}</span>
                    </div>
                    <button onClick={() => searchCancelledRef.current = true} className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/40 text-sm font-bold rounded transition-colors">
                      Cancel Search
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* BOTTOM ROW: RESULTS GRID */}
        {results.length > 0 && (
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 w-full mt-2">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-2xl font-bold">Top Matches</h3>
               <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-sm text-blue-400 hover:text-blue-300">↑ Back to Query</button>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
               {results.map((match, idx) => {
                 const hasDx = match.charts?.some(c => (c.type || '').toLowerCase().includes('dx'));
                 const hasStd = match.charts?.some(c => (c.type || '').toLowerCase().includes('std') || (c.type || '').toLowerCase().includes('standard'));
                 
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

                 // Filter charts to display only the ones matching the selected difficulty
                 const displayCharts = match.charts?.filter(c => {
                    const diffMatch = difficultyFilter.includes('All') || difficultyFilter.some(d => d.toLowerCase().replace(':', '') === (c.difficulty || '').toLowerCase().replace(':', ''));
                    const levelMatch = parseFloat(c.internalLevel || c.level || 0) >= minLevel && parseFloat(c.internalLevel || c.level || 0) <= maxLevel;
                    let rawType = (c.type || '').toLowerCase();
                    const typeMatch = (chartTypeFilter.includes('DX') && rawType.includes('dx')) || 
                                      (chartTypeFilter.includes('STD') && (rawType.includes('std') || rawType.includes('standard')));
                    return diffMatch && levelMatch && typeMatch;
                 });

                 return (
                 <div key={idx} className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700 flex flex-col relative group">
                   {idx === 0 && <div className="absolute top-2 right-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg z-10 uppercase tracking-wider">Best Match</div>}
                   <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                    {hasDx && <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg border border-blue-400/50">DX</div>}
                    {hasStd && <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg border border-green-400/50">STD</div>}
                   </div>
                   
                   <div className="relative pt-[100%] z-0 overflow-hidden bg-gray-950">
                     <img 
                       src={`https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover/${match.imageName}`} 
                       onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/300?text=No+Image'}
                       className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                       alt={match.title}
                     />
                     <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
                       <div className="text-[10px] text-blue-300 font-mono font-semibold tracking-wide drop-shadow-md">{match.score} pts</div>
                     </div>
                   </div>
                   <div className="p-3 flex-1 flex flex-col z-10 bg-gray-900 border-t border-gray-800">
                     <div className="flex justify-between items-start gap-2 mb-1">
                       <h4 className="font-bold text-sm leading-snug line-clamp-2" title={match.title}>{match.title || match.imageName}</h4>
                       <button onClick={() => handleCopy(match.title || '')} className="text-gray-400 hover:text-white mt-0.5 shrink-0 transition-colors bg-gray-800 p-1 rounded"><Copy size={12}/></button>
                     </div>
                     <p className="text-[10px] text-gray-400 mb-1 line-clamp-1">{match.artist}</p>
                     
                     {(match.version || match.releaseDate) && (
                        <div className="flex flex-col gap-0.5 text-[9px] text-gray-500 mb-2 font-medium">
                          {match.version && <span>Ver: {match.version}</span>}
                          {match.releaseDate && <span>Added: {match.releaseDate}</span>}
                        </div>
                     )}
                     
                     {displayCharts && displayCharts.length > 0 && (
                       <div className="mb-3">
                         <div className="text-[9px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Matched Charts:</div>
                         <div className="flex gap-1 flex-wrap">
                            {displayCharts.map((c, i) => (
                              <div key={i} className={`flex items-stretch text-[9px] rounded overflow-hidden shadow-sm border border-gray-700`}>
                                <span className={`${getDiffColor(c.difficulty || '')} px-1.5 py-0.5 font-bold uppercase`}>
                                  {(c.type || '').substring(0,2).toUpperCase()} {(c.difficulty || '').substring(0,3)}
                                </span>
                                <span className="bg-gray-800 text-gray-200 px-1.5 py-0.5 font-bold">
                                  {c.level} <span className="text-gray-400 font-normal">({parseFloat(c.internalLevel || 0).toFixed(1)})</span>
                                </span>
                              </div>
                            ))}
                         </div>
                       </div>
                     )}
                     
                     <div className="flex gap-1.5 mt-auto">
                       <a href={`https://arcade-songs.zetaraku.dev/maimai/?title=${encodeURIComponent(match.title || '')}`} target="_blank" className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-center py-1.5 text-[10px] rounded font-bold transition-colors">Zetaraku</a>
                       <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent('maimai ' + (match.title || ''))}`} target="_blank" className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 text-center py-1.5 text-[10px] rounded font-bold transition-colors">YouTube</a>
                     </div>
                   </div>
                 </div>
               )})}
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
