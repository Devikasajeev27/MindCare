import React, { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, BookOpen, Play, Headphones, FileText, Clock, Star, X, CheckCircle2, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

const iconMap: Record<string, React.ComponentType<any>> = {
  video: Play,
  article: FileText,
  audio: Headphones,
  exercise: BookOpen,
};

function ResourceModal({ resource, onClose }: { resource: any; onClose: () => void }) {
  const isVideo = resource.type === "video" || resource.category === "Videos";
  const isAudio = resource.type === "audio" || resource.category === "Audio";
  const mediaUrl = typeof resource.mediaUrl === "string" ? resource.mediaUrl.trim() : "";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white dark:bg-zinc-950 shadow-2xl border border-gray-100 dark:border-zinc-800 my-8"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Media Player or Banner */}
          <div className="relative h-60 sm:h-72 overflow-hidden bg-slate-900">
            {isVideo && mediaUrl ? (
              <video
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
                poster={resource.image}
              >
                <source src={mediaUrl} type="video/mp4" />
                Your browser does not support HTML5 video playback.
              </video>
            ) : (
              <>
                <img src={resource.image} alt={resource.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
              </>
            )}

            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 rounded-full bg-black/60 p-2 text-white hover:bg-black/90 backdrop-blur-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {!isVideo && (
              <div className="absolute bottom-4 left-5 right-5 text-white">
                <Badge className="bg-primary text-white border-0 text-[10px] font-bold mb-2">
                  {resource.tag}
                </Badge>
                <h2 className="text-xl sm:text-2xl font-black leading-tight drop-shadow-sm">{resource.title}</h2>
                <div className="flex items-center gap-3 text-xs text-slate-200 mt-1 font-medium">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" /> {resource.meta}</span>
                  <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /> {typeof resource.rating === "number" ? resource.rating.toFixed(1) : "Not rated"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Modal Body Content */}
          <div className="p-6 sm:p-8 space-y-6 max-h-[55vh] overflow-y-auto">
            {isAudio && mediaUrl && (
              <div className="p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-inner">
                      <Volume2 className="w-6 h-6 animate-pulse text-purple-200" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">Guided Audio Meditation</h4>
                      <p className="text-xs text-purple-200 font-medium">High Quality Audio Stream</p>
                    </div>
                  </div>
                </div>
                <audio controls autoPlay className="w-full rounded-xl mt-2">
                  <source src={mediaUrl} type="audio/mp3" />
                  Your browser does not support HTML5 audio playback.
                </audio>
              </div>
            )}

            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-gray-700 dark:text-zinc-300 space-y-4">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Clinical Overview &amp; Instructions
              </h3>
              <p>{resource.content || resource.meta || "No additional content has been published for this resource."}</p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-900/80 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
            <Button onClick={onClose} className="rounded-xl bg-primary text-white font-bold text-xs px-6 h-10 shadow-sm">
              Close Resource
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Resources() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [resources, setResources] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState<any | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("search");
    if (query) {
      setSearch(query);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.resources.list({ search: search || undefined, category: activeCategory === 'All' ? undefined : activeCategory })
      .then(({ resources: res, categories: resourceCategories }) => {
        if (cancelled) return;
        setResources(res || []);
        setCategories(resourceCategories || ["All"]);
      })
      .catch(() => {
        if (!cancelled) setResources([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [search, activeCategory]);

  // Combined Fail-Safe Filter: Instant Client-Side Search & Category Switching
  const filteredResources = useMemo(() => {
    return resources.filter((r: any) => {
      const catStr = activeCategory.toLowerCase();
      let matchCat = activeCategory === "All";

      if (!matchCat) {
        let typeMatch = catStr;
        if (catStr.endsWith("s")) typeMatch = catStr.slice(0, -1);

        matchCat = (r.category && r.category.toLowerCase().includes(catStr)) ||
                   (r.type && r.type.toLowerCase().includes(typeMatch)) ||
                   (r.tag && r.tag.toLowerCase().includes(catStr));
      }

      const searchLower = search.toLowerCase().trim();
      let matchSearch = !searchLower;
      if (!matchSearch) {
        matchSearch = (r.title && r.title.toLowerCase().includes(searchLower)) ||
                      (r.tag && r.tag.toLowerCase().includes(searchLower)) ||
                      (r.category && r.category.toLowerCase().includes(searchLower)) ||
                      (r.type && r.type.toLowerCase().includes(searchLower)) ||
                      (r.meta && r.meta.toLowerCase().includes(searchLower));
      }

      return matchCat && matchSearch;
    });
  }, [resources, activeCategory, search]);

  return (
    <AppLayout>
      {selectedResource && (
        <ResourceModal resource={selectedResource} onClose={() => setSelectedResource(null)} />
      )}

      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Resources</h1>
          <p className="text-sm text-gray-500">Curated content to support your mental wellness journey.</p>
        </div>
        
        <div className="relative rounded-3xl overflow-hidden h-44">
          <img src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=1200" alt="Resources" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 to-purple-600/30" />
          <div className="absolute inset-0 flex items-center px-8 text-white">
            <div>
              <h2 className="text-2xl font-bold mb-1">Wellness Library</h2>
              <p className="text-sm text-white/80 max-w-xs">Evidence-based articles, videos, and exercises for your mental health.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by title, tag, or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11 rounded-xl border-gray-200 bg-white"
            />
          </div>
          {search && (
            <Button onClick={() => setSearch("")} variant="ghost" className="h-11 rounded-xl text-xs gap-1 text-gray-500">
              <X className="w-4 h-4" /> Clear
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                activeCategory === c
                  ? 'bg-primary text-white shadow-sm scale-105'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-gray-400 text-center py-8">Loading resources...</p>}

        {!loading && filteredResources.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">No resources matched your search</h3>
            <p className="mt-2 text-sm text-gray-500">Try another keyword or switch category filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredResources.map((r: any, i: number) => {
              const Icon = iconMap[r.type] || BookOpen;
              return (
                <motion.div
                  key={r.title + i}
                  onClick={() => setSelectedResource(r)}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-40 overflow-hidden">
                      <img src={r.image} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-primary text-white border-0 text-[10px] font-bold">{r.tag}</Badge>
                      </div>
                      <div className="absolute bottom-3 left-3">
                        <div className="w-8 h-8 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center text-white shadow-sm">
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="font-bold text-gray-800 text-sm mb-1 line-clamp-2">{r.title}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" />{r.meta}</div>
                        <div className="flex items-center gap-1 font-semibold text-gray-700">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />{typeof r.rating === "number" ? r.rating : "Not rated"}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
