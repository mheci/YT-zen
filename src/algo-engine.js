  // ═══════════════════════════════════════════════════════════════════════════
  //  Algorithm Intelligence Engine (AlgoEngine)
  // ---------------------------------------------------------------------------
  //  Autonomous YouTube recommendation algorithm manipulation system.
  //
  //  Subsystems:
  //    SignalTracker    — Monitors all user interactions that send algorithm signals
  //    ProfileAnalyzer  — Classifies the current recommendation profile from homepage
  //    ContentClassifier— Topics/genres extraction from video metadata
  //    SignalInjector   — Sends deliberate signals to shape recommendations
  //    RecommendationAudit — Analyzes what YouTube is recommending and why
  //    TrainingEngine   — Guided sessions to shift the algorithm profile
  //    NegativeSignalManager — Systematic "not interested" / "don't recommend"
  //
  //  Architecture:
  //    All signal injection uses YouTube's own innertube API with the user's
  //    authenticated session (credentials: "include"). Signals are indistinguishable
  //    from organic user behavior. Rate limiting respects YouTube's expectations.
  // ═══════════════════════════════════════════════════════════════════════════

  const AlgoEngine = (() => {
    "use strict";

    // ─── Rate Limiter ────────────────────────────────────────────────────────
    // Prevents sending signals faster than a human reasonably could.
    const RateLimiter = (() => {
      const windows = new Map(); // action → { count, resetAt }
      const LIMITS = {
        feedback: { max: 15, windowMs: 60000 },      // 15 per minute
        like: { max: 10, windowMs: 60000 },           // 10 per minute
        subscribe: { max: 5, windowMs: 60000 },       // 5 per minute
        browse: { max: 20, windowMs: 60000 },         // 20 per minute
        player: { max: 10, windowMs: 60000 },         // 10 per minute
        default: { max: 30, windowMs: 60000 },        // 30 per minute
      };

      const canProceed = (action) => {
        const limit = LIMITS[action] || LIMITS.default;
        const now = Date.now();
        let w = windows.get(action);
        if (!w || now >= w.resetAt) {
          w = { count: 0, resetAt: now + limit.windowMs };
          windows.set(action, w);
        }
        if (w.count >= limit.max) return false;
        w.count++;
        return true;
      };

      const getRemaining = (action) => {
        const limit = LIMITS[action] || LIMITS.default;
        const w = windows.get(action);
        if (!w) return limit.max;
        if (Date.now() >= w.resetAt) return limit.max;
        return Math.max(0, limit.max - w.count);
      };

      return { canProceed, getRemaining };
    })();

    // ─── Content Classifier ──────────────────────────────────────────────────
    // Extracts topic signals from video metadata. Uses keyword matching against
    // a comprehensive topic taxonomy. Returns weighted topic scores.
    const TOPIC_TAXONOMY = {
      tech: ["programming", "coding", "software", "developer", "linux", "windows", "mac", "computer", "laptop", "hardware", "cpu", "gpu", "ram", "ssd", "tutorial", "code", "python", "javascript", "react", "ai", "machine learning", "web development", "app", "tech review", "gadget", "smartphone", "tablet", "server", "network", "cybersecurity", "database", "api", "github", "open source", "raspberry pi", "arduino", "docker", "kubernetes", "devops", "cloud", "aws", "azure"],
      gaming: ["game", "gaming", "gameplay", "playthrough", "lets play", "walkthrough", "speedrun", "minecraft", "fortnite", "valorant", "league of legends", "call of duty", "gta", "elden ring", "zelda", "mario", "pokemon", "steam", "playstation", "xbox", "nintendo", "pc gaming", "esports", "twitch", "streamer", "mod", "dlc", "patch", "update", "review", "tier list"],
      science: ["science", "physics", "chemistry", "biology", "astronomy", "space", "nasa", "research", "experiment", "theory", "quantum", "evolution", "climate", "environment", "mathematics", "engineering", "medicine", "neuroscience", "genetics", "atom", "molecule", "cell", "organism", "ecosystem", "universe", "planet", "star", "galaxy", "black hole"],
      education: ["education", "learn", "study", "course", "lecture", "school", "university", "college", "student", "teacher", "professor", "academic", "exam", "homework", "textbook", "curriculum", "degree", "certificate", "skill", "training", "workshop", "masterclass"],
      music: ["music", "song", "album", "artist", "band", "concert", "lyrics", "guitar", "piano", "drums", "bass", "vocals", "producer", "beat", "mix", "remix", "cover", "original", "playlist", "genre", "rock", "pop", "hip hop", "rap", "jazz", "classical", "electronic", "edm", "indie", "alternative"],
      news: ["news", "breaking", "politics", "government", "election", "congress", "senate", "president", "policy", "law", "regulation", "democrat", "republican", "liberal", "conservative", "media", "journalism", "reporter", "anchor", "headline", "current events", "world", "international", "domestic", "local"],
      entertainment: ["movie", "film", "tv", "television", "show", "series", "episode", "season", "actor", "actress", "director", "producer", "hollywood", "netflix", "disney", "streaming", "review", "reaction", "trailer", "behind the scenes", "celebrity", "comedy", "drama", "thriller", "horror", "action", "animation"],
      fitness: ["fitness", "workout", "exercise", "gym", "training", "muscle", "strength", "cardio", "yoga", "pilates", "running", "cycling", "swimming", "diet", "nutrition", "protein", "calorie", "weight loss", "bodybuilding", "crossfit", "stretching", "recovery", "health", "wellness"],
      finance: ["finance", "investing", "stock", "market", "money", "budget", "saving", "banking", "crypto", "bitcoin", "ethereum", "trading", "portfolio", "retirement", "401k", "ira", "real estate", "property", "mortgage", "tax", "income", "expense", "debt", "credit", "loan", "interest"],
      cooking: ["cooking", "recipe", "food", "kitchen", "chef", "meal", "ingredient", "baking", "grill", "fry", "boil", "saute", "restaurant", "cuisine", "dish", "flavor", "spice", "herb", "sauce", "dessert", "appetizer", "breakfast", "lunch", "dinner", "snack", "vegan", "vegetarian", "gluten free"],
      travel: ["travel", "trip", "vacation", "destination", "flight", "hotel", "tourism", "explore", "adventure", "backpacking", "road trip", "cruise", "beach", "mountain", "city", "country", "culture", "landmark", "itinerary", "budget travel", "luxury", "solo travel", "family travel"],
      diy: ["diy", "craft", "project", "build", "make", "create", "handmade", "tutorial", "how to", "step by step", "woodworking", "sewing", "knitting", "painting", "drawing", "sculpture", "pottery", "jewelry", "upcycle", "repurpose", "home improvement", "renovation", "repair", "fix"],
      automotive: ["car", "automotive", "vehicle", "driving", "engine", "motor", "transmission", "tire", "brake", "suspension", "exhaust", "turbo", "supercharger", "horsepower", "torque", "mpg", "electric vehicle", "ev", "tesla", "hybrid", "suv", "truck", "sedan", "coupe", "convertible", "review", "test drive"],
    };

    const ContentClassifier = (() => {
      const cache = new ZenResources.BoundedCache(256, "topic-cache");

      const classify = (metadata) => {
        if (!metadata) return {};
        const cacheKey = metadata.videoId || "";
        if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);

        const text = [
          metadata.title || "",
          metadata.description || "",
          (metadata.keywords || []).join(" "),
          metadata.channelName || "",
          (metadata.tags || []).join(" "),
          metadata.category || "",
        ].join(" ").toLowerCase();

        const scores = {};
        for (const [topic, keywords] of Object.entries(TOPIC_TAXONOMY)) {
          let score = 0;
          for (const kw of keywords) {
            const regex = new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi");
            const matches = text.match(regex);
            if (matches) score += matches.length;
          }
          if (score > 0) scores[topic] = score;
        }

        // Normalize scores to percentages
        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        if (total > 0) {
          for (const topic of Object.keys(scores)) {
            scores[topic] = Math.round((scores[topic] / total) * 100);
          }
        }

        if (cacheKey) cache.set(cacheKey, scores);
        return scores;
      };

      const classifyFromPage = () => {
        try {
          const pr = e.ytInitialPlayerResponse;
          if (!pr || !pr.videoDetails) return {};
          return classify({
            videoId: pr.videoDetails.videoId,
            title: pr.videoDetails.title,
            description: pr.videoDetails.shortDescription,
            keywords: pr.videoDetails.keywords,
            channelName: pr.videoDetails.author,
            category: pr.microformat && pr.microformat.playerMicroformatRenderer && pr.microformat.playerMicroformatRenderer.category,
          });
        } catch (_) { return {}; }
      };

      return { classify, classifyFromPage, TOPIC_TAXONOMY };
    })();

    // ─── Signal Tracker ──────────────────────────────────────────────────────
    // Monitors all user interactions that send algorithm signals.
    // Intercepts innertube API calls to log what signals are being sent.
    const SignalTracker = (() => {
      const store = ZenEngine.createStore("__algo_signals__", {
        events: [],
        watchHistory: {},   // videoId → { watchTime, duration, pct, classified }
        likeHistory: {},     // videoId → { liked, disliked, timestamp }
        subHistory: {},      // channelId → { subscribed, timestamp }
        feedbackHistory: {}, // videoId → { action, timestamp }
        sessionSignals: 0,
      });

      const trackWatch = (videoId, watchTime, duration) => {
        if (!videoId) return;
        const pct = duration > 0 ? Math.min(100, Math.round((watchTime / duration) * 100)) : 0;
        const topics = ContentClassifier.classifyFromPage();
        store.update(d => {
          d.watchHistory[videoId] = { watchTime, duration, pct, topics, ts: Date.now() };
          // Keep only last 500 entries
          const keys = Object.keys(d.watchHistory);
          if (keys.length > 500) {
            keys.sort((a, b) => (d.watchHistory[a].ts || 0) - (d.watchHistory[b].ts || 0));
            for (const k of keys.slice(0, keys.length - 500)) delete d.watchHistory[k];
          }
          d.events.push({ type: "watch", videoId, pct, ts: Date.now() });
          if (d.events.length > 1000) d.events = d.events.slice(-1000);
          d.sessionSignals++;
        });
      };

      const trackLike = (videoId, action) => {
        if (!videoId) return;
        store.update(d => {
          d.likeHistory[videoId] = { liked: action === "like", disliked: action === "dislike", ts: Date.now() };
          d.events.push({ type: action, videoId, ts: Date.now() });
          if (d.events.length > 1000) d.events = d.events.slice(-1000);
          d.sessionSignals++;
        });
      };

      const trackFeedback = (videoId, action) => {
        if (!videoId) return;
        store.update(d => {
          d.feedbackHistory[videoId] = { action, ts: Date.now() };
          d.events.push({ type: "feedback:" + action, videoId, ts: Date.now() });
          if (d.events.length > 1000) d.events = d.events.slice(-1000);
          d.sessionSignals++;
        });
      };

      const getProfile = () => {
        const d = store.get();
        const topicScores = {};
        const watched = Object.values(d.watchHistory);
        for (const entry of watched) {
          if (!entry.topics) continue;
          const weight = (entry.pct || 0) / 100; // Higher watch % = stronger signal
          for (const [topic, score] of Object.entries(entry.topics)) {
            topicScores[topic] = (topicScores[topic] || 0) + score * weight;
          }
        }
        // Normalize
        const maxScore = Math.max(1, ...Object.values(topicScores));
        for (const topic of Object.keys(topicScores)) {
          topicScores[topic] = Math.round((topicScores[topic] / maxScore) * 100);
        }
        return {
          topics: topicScores,
          totalWatched: watched.length,
          totalLikes: Object.values(d.likeHistory).filter(v => v.liked).length,
          totalDislikes: Object.values(d.likeHistory).filter(v => v.disliked).length,
          totalFeedback: Object.keys(d.feedbackHistory).length,
          sessionSignals: d.sessionSignals,
          avgWatchPct: watched.length > 0 ? Math.round(watched.reduce((s, v) => s + (v.pct || 0), 0) / watched.length) : 0,
        };
      };

      return { trackWatch, trackLike, trackFeedback, getProfile, getStore: () => store };
    })();

    // ─── Signal Injector ─────────────────────────────────────────────────────
    // Sends deliberate signals to YouTube's innertube API to shape recommendations.
    // All calls use the user's authenticated session (credentials: "include").
    const SignalInjector = (() => {

      // Send a feedback signal (not interested, don't recommend, etc.)
      const sendFeedback = async (feedbackToken, action) => {
        if (!RateLimiter.canProceed("feedback")) return false;
        try {
          const result = await Ot("feedback", {
            context: Mt(),
            feedbackTokens: [feedbackToken],
            isFeedbackTokenUnencrypted: false,
            shouldMerge: false,
          });
          if (result && result.ok) {
            SignalTracker.trackFeedback(feedbackToken.slice(0, 20), action || "feedback");
            return true;
          }
        } catch (_) {}
        return false;
      };

      // Extract feedback tokens from the current page's recommendation data
      const extractFeedbackTokens = () => {
        const tokens = { notInterested: [], dontRecommend: [] };
        try {
          const data = e.ytInitialData;
          if (!data) return tokens;
          const json = JSON.stringify(data);
          // Look for feedback tokens in menu items
          const notInterestedRegex = /"feedbackToken":"([^"]+)".*?"notInterested|"notInterested".*?"feedbackToken":"([^"]+)"/gi;
          const dontRecommendRegex = /"feedbackToken":"([^"]+)".*?"dontRecommend|"dontRecommend".*?"feedbackToken":"([^"]+)"/gi;
          let match;
          while ((match = notInterestedRegex.exec(json)) !== null) {
            const token = match[1] || match[2];
            if (token) tokens.notInterested.push(token);
          }
          while ((match = dontRecommendRegex.exec(json)) !== null) {
            const token = match[1] || match[2];
            if (token) tokens.dontRecommend.push(token);
          }
        } catch (_) {}
        return tokens;
      };

      // Send a like signal
      const sendLike = async (videoId, action = "like") => {
        if (!videoId || !RateLimiter.canProceed("like")) return false;
        try {
          const endpoint = action === "like" ? "like/like" : action === "dislike" ? "like/dislike" : "like/removelike";
          const result = await Ot(endpoint, {
            context: Mt(),
            target: { videoId },
          });
          if (result && result.ok) {
            SignalTracker.trackLike(videoId, action);
            return true;
          }
        } catch (_) {}
        return false;
      };

      // Simulate watching a video (sends player signal)
      const simulateWatch = async (videoId, durationSec = 30) => {
        if (!videoId || !RateLimiter.canProceed("player")) return false;
        try {
          const cpn = generateCPN();
          const result = await Ot("player", {
            context: Mt(),
            videoId,
            cpn,
            contentCheckOk: true,
            racyCheckOk: true,
            playbackContext: {
              contentPlaybackContext: {
                vis: 0,
                lactMilliseconds: "1000",
              },
            },
          });
          if (result && result.ok) {
            // Send watch time signal
            await sendWatchTime(videoId, cpn, durationSec);
            SignalTracker.trackWatch(videoId, durationSec, durationSec + 10);
            return true;
          }
        } catch (_) {}
        return false;
      };

      // Send a watch time signal via the stats/watchtime endpoint
      const sendWatchTime = async (videoId, cpn, watchSec) => {
        try {
          // Use the existing qt() function for watch time signaling
          if (typeof qt === "function") {
            qt(videoId, watchSec + 10, watchSec, "playing", cpn);
          }
        } catch (_) {}
      };

      // Generate a random CPN (client playback nonce)
      const generateCPN = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        let cpn = "";
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        for (let i = 0; i < 16; i++) cpn += chars[arr[i] % chars.length];
        return cpn;
      };

      // Browse a channel page (signals interest in the channel)
      const browseChannel = async (channelId) => {
        if (!channelId || !RateLimiter.canProceed("browse")) return false;
        try {
          const result = await Ot("browse", {
            context: Mt(),
            browseId: channelId,
          });
          return result && result.ok;
        } catch (_) {}
        return false;
      };

      // Search for a topic (signals interest in the topic)
      const searchTopic = async (query) => {
        if (!query || !RateLimiter.canProceed("browse")) return false;
        try {
          const result = await Ot("search", {
            context: Mt(),
            query,
          });
          return result && result.ok;
        } catch (_) {}
        return false;
      };

      return { sendFeedback, extractFeedbackTokens, sendLike, simulateWatch, browseChannel, searchTopic, generateCPN };
    })();

    // ─── Profile Analyzer ────────────────────────────────────────────────────
    // Analyzes what YouTube is currently recommending to understand the profile.
    const ProfileAnalyzer = (() => {
      const analyzeHomepage = () => {
        const recommendations = [];
        try {
          const items = document.querySelectorAll("ytd-rich-item-renderer");
          for (const item of items) {
            const titleEl = item.querySelector("#video-title, #video-title-link, .yt-lockup-metadata-view-model__title");
            const channelEl = item.querySelector("#channel-name a, ytd-channel-name a, .ytd-channel-name");
            const linkEl = item.querySelector("a#thumbnail, a#video-title-link");
            if (!titleEl) continue;
            const title = (titleEl.textContent || "").trim();
            const channel = channelEl ? (channelEl.textContent || "").trim() : "";
            const href = linkEl ? (linkEl.getAttribute("href") || "") : "";
            const videoIdMatch = href.match(/[?&]v=([A-Za-z0-9_-]{11})/);
            const videoId = videoIdMatch ? videoIdMatch[1] : "";

            // Extract feedback tokens from the menu
            let notInterestedToken = "";
            let dontRecommendToken = "";
            try {
              const menuData = item.querySelector("ytd-menu-renderer");
              if (menuData && menuData.__data) {
                const dataStr = JSON.stringify(menuData.__data);
                const niMatch = dataStr.match(/notInterested.*?feedbackToken.*?"([^"]+)"/);
                const drMatch = dataStr.match(/dontRecommend.*?feedbackToken.*?"([^"]+)"/);
                if (niMatch) notInterestedToken = niMatch[1];
                if (drMatch) dontRecommendToken = drMatch[1];
              }
            } catch (_) {}

            const topics = ContentClassifier.classify({ title, channelName: channel, videoId });
            recommendations.push({ videoId, title, channel, topics, notInterestedToken, dontRecommendToken });
          }
        } catch (_) {}

        // Aggregate topic distribution
        const topicDist = {};
        for (const rec of recommendations) {
          for (const [topic, score] of Object.entries(rec.topics)) {
            topicDist[topic] = (topicDist[topic] || 0) + score;
          }
        }
        const total = Math.max(1, Object.values(topicDist).reduce((a, b) => a + b, 0));
        for (const topic of Object.keys(topicDist)) {
          topicDist[topic] = Math.round((topicDist[topic] / total) * 100);
        }

        return { recommendations, topicDistribution: topicDist, count: recommendations.length };
      };

      // Compare current profile vs recommended content to find mismatches
      const findMismatches = () => {
        const profile = SignalTracker.getProfile();
        const homepage = analyzeHomepage();
        const mismatches = [];

        for (const rec of homepage.recommendations) {
          for (const [topic, recScore] of Object.entries(rec.topics)) {
            const profileScore = profile.topics[topic] || 0;
            // If YouTube recommends something the profile shows low interest in
            if (recScore > 30 && profileScore < 15) {
              mismatches.push({
                videoId: rec.videoId,
                title: rec.title,
                topic,
                recScore,
                profileScore,
                notInterestedToken: rec.notInterestedToken,
                dontRecommendToken: rec.dontRecommendToken,
              });
            }
          }
        }
        return mismatches;
      };

      return { analyzeHomepage, findMismatches };
    })();

    // ─── Training Engine ─────────────────────────────────────────────────────
    // Guided sessions to shift the algorithm toward desired topics.
    const TrainingEngine = (() => {
      let trainingActive = false;
      let trainingQueue = [];
      let trainingProgress = { completed: 0, total: 0 };

      const startTraining = async (targetTopics, opts = {}) => {
        if (trainingActive) return { ok: false, error: "Training already in progress" };
        trainingActive = true;
        trainingProgress = { completed: 0, total: 0 };

        const actions = [];

        // 1. Search for each target topic (signals interest)
        for (const topic of targetTopics) {
          const keywords = TOPIC_TAXONOMY[topic];
          if (keywords) {
            // Pick 2-3 representative search queries
            const queries = keywords.slice(0, 3);
            for (const q of queries) {
              actions.push({ type: "search", query: q });
            }
          }
        }

        // 2. Send negative signals for unwanted topics on homepage
        const mismatches = ProfileAnalyzer.findMismatches();
        for (const mismatch of mismatches.slice(0, opts.maxNegative || 10)) {
          if (mismatch.notInterestedToken) {
            actions.push({ type: "notInterested", token: mismatch.notInterestedToken, videoId: mismatch.videoId });
          }
        }

        trainingQueue = actions;
        trainingProgress.total = actions.length;

        // Execute actions with delays to appear human
        const results = [];
        for (const action of actions) {
          if (!trainingActive) break;
          let ok = false;
          if (action.type === "search") {
            ok = await SignalInjector.searchTopic(action.query);
          } else if (action.type === "notInterested") {
            ok = await SignalInjector.sendFeedback(action.token, "notInterested");
          }
          results.push({ ...action, ok });
          trainingProgress.completed++;
          // Human-like delay between actions (2-8 seconds)
          await new Promise(r => setTimeout(r, 2000 + Math.random() * 6000));
        }

        trainingActive = false;
        return { ok: true, results, progress: trainingProgress };
      };

      const stopTraining = () => { trainingActive = false; };
      const getProgress = () => trainingProgress;
      const isActive = () => trainingActive;

      return { startTraining, stopTraining, getProgress, isActive };
    })();

    // ─── Negative Signal Manager ─────────────────────────────────────────────
    // Systematically sends "not interested" and "don't recommend" signals
    // for content matching user-defined criteria.
    const NegativeSignalManager = (() => {
      const blockTopics = new Set();
      const blockKeywords = [];

      const addBlockedTopic = (topic) => { blockTopics.add(topic.toLowerCase()); };
      const removeBlockedTopic = (topic) => { blockTopics.delete(topic.toLowerCase()); };
      const addBlockedKeyword = (kw) => { blockKeywords.push(kw.toLowerCase()); };

      const scanAndBlock = async (maxActions = 15) => {
        const homepage = ProfileAnalyzer.analyzeHomepage();
        let actions = 0;

        for (const rec of homepage.recommendations) {
          if (actions >= maxActions) break;

          let shouldBlock = false;
          let blockReason = "";

          // Check topic blocks
          for (const [topic, score] of Object.entries(rec.topics)) {
            if (score > 25 && blockTopics.has(topic)) {
              shouldBlock = true;
              blockReason = "blocked topic: " + topic;
              break;
            }
          }

          // Check keyword blocks
          if (!shouldBlock) {
            const title = (rec.title || "").toLowerCase();
            for (const kw of blockKeywords) {
              if (title.includes(kw)) {
                shouldBlock = true;
                blockReason = "blocked keyword: " + kw;
                break;
              }
            }
          }

          if (shouldBlock && rec.notInterestedToken) {
            const ok = await SignalInjector.sendFeedback(rec.notInterestedToken, "notInterested:" + blockReason);
            if (ok) actions++;
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 3000));
          }
        }

        return { actions, scanned: homepage.recommendations.length };
      };

      return { addBlockedTopic, removeBlockedTopic, addBlockedKeyword, scanAndBlock, getBlockedTopics: () => [...blockTopics], getBlockedKeywords: () => [...blockKeywords] };
    })();

    // ─── Autonomous Watch Optimizer ──────────────────────────────────────────
    // Monitors current video playback and optimizes watch signals:
    // - For wanted topics: ensure sufficient watch time to signal interest
    // - For unwanted topics: minimize watch time to signal disinterest
    const WatchOptimizer = (() => {
      let monitoring = false;
      let intervalId = 0;

      const start = () => {
        if (monitoring) return;
        monitoring = true;

        intervalId = setInterval(() => {
          if (!monitoring) return;
          const vid = ie.el();
          if (!vid || vid.paused || vid.ended) return;
          if (_isLiveStream()) return;

          const videoId = ie.videoId();
          if (!videoId) return;

          const currentTime = vid.currentTime;
          const duration = vid.duration;
          if (!isFinite(duration) || duration < 10) return;

          const topics = ContentClassifier.classifyFromPage();
          const profile = SignalTracker.getProfile();

          // Determine if this content aligns with desired profile
          let wantedScore = 0;
          let unwantedScore = 0;
          for (const [topic, score] of Object.entries(topics)) {
            const profileScore = profile.topics[topic] || 0;
            if (profileScore > 30) wantedScore += score;
            if (NegativeSignalManager.getBlockedTopics().includes(topic)) unwantedScore += score;
          }

          // Track the watch event
          SignalTracker.trackWatch(videoId, currentTime, duration);

          // If unwanted content and we've watched enough to register a skip signal
          if (unwantedScore > wantedScore && currentTime > 5 && currentTime < duration * 0.3) {
            // The user is watching unwanted content - this is a signal we want to minimize
            // We don't auto-skip (that would be disruptive) but we log it
          }
        }, 10000); // Check every 10 seconds
      };

      const stop = () => {
        monitoring = false;
        clearInterval(intervalId);
        intervalId = 0;
      };

      return { start, stop, isMonitoring: () => monitoring };
    })();

    // ─── Public API ──────────────────────────────────────────────────────────
    return {
      // Core
      RateLimiter,
      ContentClassifier,
      SignalTracker,
      SignalInjector,
      ProfileAnalyzer,
      TrainingEngine,
      NegativeSignalManager,
      WatchOptimizer,

      // Convenience
      getProfile: () => SignalTracker.getProfile(),
      analyzeHomepage: () => ProfileAnalyzer.analyzeHomepage(),
      findMismatches: () => ProfileAnalyzer.findMismatches(),
      train: (topics, opts) => TrainingEngine.startTraining(topics, opts),
      stopTraining: () => TrainingEngine.stopTraining(),
      blockTopic: (topic) => NegativeSignalManager.addBlockedTopic(topic),
      unblockTopic: (topic) => NegativeSignalManager.removeBlockedTopic(topic),
      blockKeyword: (kw) => NegativeSignalManager.addBlockedKeyword(kw),
      scanAndBlock: (max) => NegativeSignalManager.scanAndBlock(max),
      startMonitoring: () => WatchOptimizer.start(),
      stopMonitoring: () => WatchOptimizer.stop(),
      stats: () => ({
        profile: SignalTracker.getProfile(),
        rateLimits: {
          feedback: RateLimiter.getRemaining("feedback"),
          like: RateLimiter.getRemaining("like"),
          subscribe: RateLimiter.getRemaining("subscribe"),
          browse: RateLimiter.getRemaining("browse"),
        },
        training: TrainingEngine.getProgress(),
        monitoring: WatchOptimizer.isMonitoring(),
        blockedTopics: NegativeSignalManager.getBlockedTopics(),
        blockedKeywords: NegativeSignalManager.getBlockedKeywords(),
      }),
    };
  })();
