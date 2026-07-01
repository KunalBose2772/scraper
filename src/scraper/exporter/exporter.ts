import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { BusinessDetails, ScraperConfig } from '../../types';
import { Logger } from '../../utils/logger';

export class Exporter {
  /**
   * Main export method that writes files based on configured outputFormat.
   */
  public static export(data: BusinessDetails[], config: ScraperConfig, outputDir: string): void {
    if (data.length === 0) {
      Logger.warn('No data available to export.');
      return;
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const format = config.outputFormat.toUpperCase();

    // 1. Export JSON
    if (format === 'JSON' || format === 'ALL') {
      const filePath = path.join(outputDir, 'results.json');
      try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        Logger.info(`Successfully exported JSON: ${filePath}`);
      } catch (err) {
        Logger.error('Failed to export JSON file', err);
      }
    }

    // Prepare flattened data for CSV and Excel
    const flattenedRows = data.map((item) => this.flattenRecord(item));

    // Convert flattened rows to SheetJS Worksheet
    const worksheet = XLSX.utils.json_to_sheet(flattenedRows);

    // 2. Export CSV
    if (format === 'CSV' || format === 'ALL') {
      const filePath = path.join(outputDir, 'results.csv');
      try {
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);
        fs.writeFileSync(filePath, csvContent, 'utf8');
        Logger.info(`Successfully exported CSV: ${filePath}`);
      } catch (err) {
        Logger.error('Failed to export CSV file', err);
      }
    }

    // 3. Export Excel (XLSX)
    if (format === 'EXCEL' || format === 'ALL') {
      const filePath = path.join(outputDir, 'results.xlsx');
      try {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Scraped Businesses');
        XLSX.writeFile(workbook, filePath);
        Logger.info(`Successfully exported Excel: ${filePath}`);
      } catch (err) {
        Logger.error('Failed to export Excel file', err);
      }
    }
  }

  /**
   * Flattens a nested BusinessDetails object into a single-level row suitable for table exports.
   */
  private static flattenRecord(item: BusinessDetails): Record<string, any> {
    return {
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
    };
  }
}
