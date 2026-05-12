const express = require('express');
const cors = require('cors');
const Taxjar = require('taxjar');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Taxjar({ apiKey: '4194225e0361a2392c413b08b04faac5' });

const CACHE_DIR = path.join(__dirname, '.tax-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'us-tax-data.json');
const CACHE_TTL = 24 * 60 * 60 * 1000;

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// ── Unified Tax Manager (Cache + Fetch + Filter) ──────────────────────
const TaxManager = {
  // Read valid cache
  readCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const { timestamp, payload } = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (Date.now() - timestamp < CACHE_TTL) return payload;
      }
    } catch (e) { console.warn('Cache read:', e.message); }
    return null;
  },

  // Write cache
  writeCache(payload) {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), payload }, null, 2));
    } catch (e) { console.error('Cache write:', e.message); }
  },

  // Fetch from API
  async fetchAll() {
    try {
      const res = await client.summaryRates();
      // Filter ALL entries that have country_code === 'US' (includes all US states + territories)
      const usRates = (res.summary_rates || []).filter(r => r.country_code === 'US');
      console.log('Fetched US entries:', usRates.length);
      return usRates;
    } catch (e) {
      throw new Error(`TaxJar API: ${e.message}`);
    }
  },

  // Get data (cache-first, fallback to API)
  async getData(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = this.readCache();
      if (cached) { console.log('Using cached US data'); return cached; }
    }
    const fresh = await this.fetchAll();
    this.writeCache(fresh);
    return fresh;
  },

  // Build grouped state data with city entries
  buildStateRows(data) {
    const map = {};
    data.forEach(r => {
      const state = r.region_code || 'UNKNOWN';
      if (!map[state]) {
        map[state] = {
          state,
          name: r.region || 'Unknown',
          cities: [],
          totalRate: 0
        };
      }
      const cr = (r.average_rate?.rate || 0) * 100;
      map[state].cities.push({
        city: r.city || 'N/A',
        county: r.county || null,
        zip: r.zip || null,
        combined: cr.toFixed(2) + '%',
        stateRate: ((r.state_rate?.rate || 0) * 100).toFixed(2) + '%',
        countyRate: ((r.county_rate?.rate || 0) * 100).toFixed(2) + '%',
        cityRate: ((r.city_rate?.rate || 0) * 100).toFixed(2) + '%',
        specialRate: ((r.special_rate?.rate || 0) * 100).toFixed(2) + '%'
      });
      map[state].totalRate += cr;
    });
    return Object.values(map).map(s => ({
      state: s.state,
      name: s.name,
      count: s.cities.length,
      avgRate: s.cities.length > 0 ? (s.totalRate / s.cities.length).toFixed(2) + '%' : '0.00%',
      cities: s.cities
    }));
  },

  // Unified query with filters
  async query({ state = null, city = null, search = null, refresh = false } = {}) {
    const data = await this.getData(refresh);
    let rows = this.buildStateRows(data);

    // Filter: specific state
    if (state) {
      const s = state.toUpperCase();
      rows = rows.filter(r => r.state === s);
      if (!rows.length) return { ok: false, error: `State "${state}" not found` };
    }

    // Filter: city name (within selected states)
    if (city) {
      const c = city.toLowerCase();
      rows.forEach(s => {
        s.cities = s.cities.filter(x => x.city.toLowerCase().includes(c));
      });
      rows = rows.filter(s => s.cities.length);
    }

    // Filter: keyword search across names
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.state.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.cities.some(c => c.city.toLowerCase().includes(q))
      );
    }

    // Flatten for list view
    const flat = rows.flatMap(r => r.cities.map(c => ({
      state: r.state,
      name: r.name,
      ...c
    })));

    return {
      ok: true,
      cache: this.readCache() ? 'cached' : 'live',
      states: rows,
      flat,
      totalStates: rows.length,
      totalCities: flat.length
    };
  }
};

// ── Single unified endpoint ──────────────────────────────────────────
app.get('/api/tax', async (req, res) => {
  try {
    const { state, city, q, refresh } = req.query;
    const result = await TaxManager.query({ state, city, search: q, refresh: refresh === '1' });
    if (!result.ok) return res.status(404).json(result);
    res.json({
      success: true,
      cache: result.cache,
      meta: { states: result.totalStates, cities: result.totalCities },
      states: result.states,
      list: result.flat
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`\n🚀 US Tax API (Unified + Cached)`);
  console.log(`🌐 http://localhost:${PORT}/api/tax`);
  console.log(`\nFilters:`);
  console.log(`  ?state=CA          → cities in California`);
  console.log(`  ?state=CA&city=la  → LA cities in CA`);
  console.log(`  ?q=spring          → any state/city matching`);
  console.log(`  ?refresh=1         → force API refresh`);
});