import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import cors from 'cors';
import * as XLSX from 'xlsx';
import { runSingleScrape } from '../scraper/engine';
import { Logger } from '../utils/logger';
import { ScraperConfig } from '../types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

interface ScrapeTask {
  id: string;
  keyword: string;
  location: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  current: number;
  total: number;
  message: string;
  resultsCount: number;
  error?: string;
  outputFolder?: string;
}

interface BatchState {
  id: string;
  tasks: ScrapeTask[];
  status: 'idle' | 'running' | 'completed' | 'stopped' | 'failed';
  maxResults: number;
  headless: boolean;
  currentTaskIndex: number;
}

let activeBatch: BatchState | null = null;
let isStopped = false;
let dashboardLogs: string[] = [];

// Listen for global logs and save the last 500 lines
Logger.addListener((msg) => {
  dashboardLogs.push(msg);
  if (dashboardLogs.length > 500) {
    dashboardLogs.shift();
  }
});

/**
 * Sequential batch runner thread
 */
async function runBatch() {
  if (!activeBatch) return;

  activeBatch.status = 'running';
  isStopped = false;

  for (let i = 0; i < activeBatch.tasks.length; i++) {
    if (isStopped) {
      activeBatch.tasks[i].status = 'stopped';
      activeBatch.tasks[i].message = 'Stopped by user';
      continue;
    }

    const task = activeBatch.tasks[i];
    task.status = 'running';
    task.message = 'Initializing...';
    activeBatch.currentTaskIndex = i;

    const today = new Date().toISOString().split('T')[0];
    const slug = `${task.keyword}_${task.location}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const taskDirName = `scrape-${today}_${slug}`;
    const taskDir = path.join(process.cwd(), 'output', taskDirName);
    task.outputFolder = taskDirName;

    try {
      const config: ScraperConfig = {
        keyword: task.keyword,
        location: task.location,
        maxResults: activeBatch.maxResults,
        outputFormat: 'ALL',
        headless: activeBatch.headless,
        timeout: 30000,
        retryCount: 2,
        proxy: '',
        slowMo: 0,
        exportFolder: 'output'
      };

      const results = await runSingleScrape(config, taskDir, (phase, current, total, message) => {
        task.current = current;
        task.total = total;
        task.message = message;
        if (phase === 'extracting') {
          task.resultsCount = current;
        }
      });

      task.status = 'completed';
      task.resultsCount = results.length;
      task.message = `Finished. Scraped ${results.length} rows.`;
    } catch (err: any) {
      task.status = isStopped ? 'stopped' : 'failed';
      task.message = isStopped ? 'Stopped' : `Error: ${err.message || err}`;
      task.error = err.message || String(err);
      Logger.error(`Batch task failed: "${task.keyword}" in "${task.location}"`, err);
    }
  }

  activeBatch.status = isStopped ? 'stopped' : 'completed';
}

// ==========================================
// API Endpoints
// ==========================================

/**
 * GET /api/status - Get current scraper status, queue, and logs
 */
app.get('/api/status', (req, res) => {
  res.json({
    activeBatch,
    logs: dashboardLogs
  });
});

/**
 * POST /api/start - Start a new batch scrape
 */
app.post('/api/start', (req, res) => {
  const { keywords, locations, maxResults, headless } = req.body;

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: 'Keywords list is required and must be an array.' });
  }
  if (!locations || !Array.isArray(locations) || locations.length === 0) {
    return res.status(400).json({ error: 'Locations list is required and must be an array.' });
  }

  if (activeBatch && activeBatch.status === 'running') {
    return res.status(400).json({ error: 'A scraping job is already running.' });
  }

  // Build sequential task list (Keywords x Locations)
  const tasks: ScrapeTask[] = [];
  let idCounter = 1;

  for (const keyword of keywords) {
    for (const location of locations) {
      tasks.push({
        id: `task-${idCounter++}`,
        keyword: keyword.trim(),
        location: location.trim(),
        status: 'pending',
        current: 0,
        total: 0,
        message: 'Waiting in queue...',
        resultsCount: 0
      });
    }
  }

  activeBatch = {
    id: `batch-${Date.now()}`,
    tasks,
    status: 'idle',
    maxResults: Number(maxResults) || 50,
    headless: headless !== undefined ? !!headless : true,
    currentTaskIndex: 0
  };

  dashboardLogs = [];
  Logger.info(`Starting batch run with ${tasks.length} tasks...`);

  // Run in background
  runBatch();

  res.json({ success: true, activeBatch });
});

/**
 * POST /api/stop - Stop current batch scrape
 */
app.post('/api/stop', (req, res) => {
  if (!activeBatch || activeBatch.status !== 'running') {
    return res.status(400).json({ error: 'No active scraping run to stop.' });
  }

  isStopped = true;
  activeBatch.status = 'stopped';
  Logger.warn('Batch run stop request received from user UI.');
  res.json({ success: true });
});

/**
 * GET /api/download/task - Download details for a specific completed task
 */
app.get('/api/download/task', (req, res) => {
  const { outputFolder, format } = req.query;

  if (!outputFolder || typeof outputFolder !== 'string') {
    return res.status(400).send('Invalid outputFolder parameter.');
  }

  const cleanFormat = (format && typeof format === 'string') ? format.toLowerCase() : 'xlsx';
  const folderPath = path.join(process.cwd(), 'output', outputFolder);

  if (!fs.existsSync(folderPath)) {
    return res.status(404).send('Folder not found.');
  }

  let fileName = 'results.xlsx';
  let mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (cleanFormat === 'csv') {
    fileName = 'results.csv';
    mimeType = 'text/csv';
  } else if (cleanFormat === 'json') {
    fileName = 'results.json';
    mimeType = 'application/json';
  }

  const filePath = path.join(folderPath, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`Requested file format (${cleanFormat}) not found for this task.`);
  }

  res.setHeader('Content-Disposition', `attachment; filename="${outputFolder}_${fileName}"`);
  res.setHeader('Content-Type', mimeType);
  res.sendFile(filePath);
});

/**
 * GET /api/download/combined - Compile all completed task data into a multi-sheet Excel file
 */
app.get('/api/download/combined', (req, res) => {
  if (!activeBatch) {
    return res.status(400).send('No batch job history available.');
  }

  const completedTasks = activeBatch.tasks.filter(
    (t) => t.status === 'completed' && t.outputFolder
  );

  if (completedTasks.length === 0) {
    return res.status(400).send('No completed scraper tasks found to combine.');
  }

  try {
    const workbook = XLSX.utils.book_new();

    for (const task of completedTasks) {
      const jsonPath = path.join(process.cwd(), 'output', task.outputFolder!, 'results.json');
      if (fs.existsSync(jsonPath)) {
        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const businesses = JSON.parse(rawData);

        if (Array.isArray(businesses) && businesses.length > 0) {
          // Flatten items
          const flatRows = businesses.map((item) => ({
            'Business Name': item.name,
            'Category': item.category || '',
            'Address': item.address || '',
            'Phone Number': item.phone || '',
            'Website': item.website || '',
            'Rating': item.rating !== null ? item.rating : '',
            'Review Count': item.reviewCount !== null ? item.reviewCount : '',
            'Status': item.status || '',
            'Opening Hours': item.openingHours || '',
            'Google Maps URL': item.url,
            'Latitude': item.latitude !== null ? item.latitude : '',
            'Longitude': item.longitude !== null ? item.longitude : '',
            'CID': item.cid || '',
            'Plus Code': item.plusCode || '',
            'Description': item.description || '',
            'Services': item.services ? item.services.join(', ') : '',
            'Images Count': item.imagesCount !== null ? item.imagesCount : '',
            'Owner Claimed': item.ownerClaimed === null ? 'Unknown' : item.ownerClaimed ? 'Yes' : 'No',
            'Accessibility Details': item.accessibility ? item.accessibility.join(', ') : '',
            'Emails (Website)': item.websiteDetails?.emails ? item.websiteDetails.emails.join(', ') : '',
            'Phone Numbers (Website)': item.websiteDetails?.phones ? item.websiteDetails.phones.join(', ') : '',
            'Instagram URL': item.websiteDetails?.socialMedia?.instagram || '',
            'Facebook URL': item.websiteDetails?.socialMedia?.facebook || '',
            'LinkedIn URL': item.websiteDetails?.socialMedia?.linkedin || '',
            'Twitter URL': item.websiteDetails?.socialMedia?.twitter || '',
            'YouTube URL': item.websiteDetails?.socialMedia?.youtube || '',
            'TikTok URL': item.websiteDetails?.socialMedia?.tiktok || '',
            'Pinterest URL': item.websiteDetails?.socialMedia?.pinterest || '',
            'Scraped Timestamp': item.scrapeTimestamp
          }));

          const sheet = XLSX.utils.json_to_sheet(flatRows);
          
          // Sheet names must be <= 31 characters
          let sheetName = `${task.keyword} - ${task.location}`;
          if (sheetName.length > 30) {
            sheetName = sheetName.substring(0, 27) + '...';
          }
          // Clean sheet name of invalid characters: \ / ? * : [ ]
          sheetName = sheetName.replace(/[\\\/?*:\[\]]/g, '_');

          XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
        }
      }
    }

    if (workbook.SheetNames.length === 0) {
      return res.status(404).send('No data was found in the completed tasks.');
    }

    // Write to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Combined_Scraped_Data.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err: any) {
    Logger.error('Failed to generate combined Excel workbook', err);
    res.status(500).send(`Excel generation error: ${err.message}`);
  }
});

// Start listening
app.listen(PORT, () => {
  Logger.info(`Web UI Server launched successfully. Access it at http://localhost:${PORT}`);
});
