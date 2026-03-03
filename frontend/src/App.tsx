import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <h1 className="text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-pink-500">
        maimai Tools Portal
      </h1>
      <p className="text-xl text-gray-400 mb-12 max-w-2xl">
        A collection of utilities and applets for players. Select a tool below to get started.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <Link to="/search" className="block group">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 transition-all text-left">
            <h2 className="text-2xl font-bold mb-2 group-hover:text-blue-400 transition-colors">Reverse Image Search</h2>
            <p className="text-gray-400">
              Upload a screenshot of a chart snippet to instantly identify the song, difficulty, and constants.
            </p>
          </div>
        </Link>
        
        <Link to="/pairs" className="block group">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all text-left">
            <h2 className="text-2xl font-bold mb-2 group-hover:text-purple-400 transition-colors">Pair Selection</h2>
            <p className="text-gray-400">
              Discover suitable chart pairs accommodating two different players' ratings simultaneously.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

import ImageSearchApplet from './applets/ImageSearch/ImageSearchApplet';
import PairSelectionApplet from './applets/PairSelection/PairSelectionApplet';

function App() {
  const basename = import.meta.env.BASE_URL.endsWith('/') 
    ? import.meta.env.BASE_URL.slice(0, -1) 
    : import.meta.env.BASE_URL;

  return (
    <Router basename={basename}>
      <div className="min-h-screen bg-[#0f111a] text-gray-100 font-sans selection:bg-pink-500/30">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/search" element={<ImageSearchApplet />} />
          <Route path="/pairs" element={<PairSelectionApplet />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
