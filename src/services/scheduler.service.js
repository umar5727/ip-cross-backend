const CacheService = require('./cache.service');
const cacheService = new CacheService();

/**
 * Scheduler Service for background tasks
 */
class SchedulerService {
  constructor() {
    this.jobs = {};
    this.isRunning = false;
  }

  /**
   * Start the background caching scheduler
   * @param {number} interval - Interval in milliseconds (default: 30 minutes)
   */
  startCacheRefreshJob(interval = 30 * 60 * 1000) {
    if (this.jobs.cacheRefresh) {
      clearInterval(this.jobs.cacheRefresh);
    }

    console.log(`Starting background cache refresh job with interval: ${interval}ms`);
    
    // Run immediately on startup
    this._refreshPopularSearches();
    
    // Then schedule regular updates
    this.jobs.cacheRefresh = setInterval(() => {
      this._refreshPopularSearches();
    }, interval);
    
    return this;
  }

  /**
   * Stop the background caching scheduler
   */
  stopCacheRefreshJob() {
    if (this.jobs.cacheRefresh) {
      clearInterval(this.jobs.cacheRefresh);
      delete this.jobs.cacheRefresh;
      console.log('Background cache refresh job stopped');
    }
    return this;
  }

  /**
   * Private method to refresh popular searches
   * @private
   */
  async _refreshPopularSearches() {
    if (this.isRunning) {
      console.log('Cache refresh already in progress, skipping');
      return;
    }

    this.isRunning = true;
    console.log('Starting cache refresh for popular searches');
    
    try {
      // Get top 20 popular searches
      const popularSearches = await cacheService.getPopularSearchTerms(20);
      
      if (!popularSearches || popularSearches.length === 0) {
        console.log('No popular searches found to cache');
        this.isRunning = false;
        return;
      }
      
      console.log(`Found ${popularSearches.length} popular searches to cache`);
      
      // Process each search term sequentially to avoid overwhelming the system
      for (const term of popularSearches) {
        try {
          await cacheService.preCacheSearchResults(term);
          console.log(`Successfully cached results for search term: ${term}`);
        } catch (error) {
          console.error(`Error caching results for term "${term}":`, error);
        }
      }
      
      console.log('Cache refresh completed successfully');
    } catch (error) {
      console.error('Error during cache refresh:', error);
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = SchedulerService;