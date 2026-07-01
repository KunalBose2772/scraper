import { Logger } from '../../utils/logger';

export class UrlParser {
  /**
   * Extracts latitude and longitude from a Google Maps URL.
   * Example: https://www.google.com/maps/place/Restaurant/@19.0305,72.8465,17z/data=...
   */
  public static parseCoordinates(url: string): { latitude: number | null; longitude: number | null } {
    try {
      const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        const latitude = parseFloat(match[1]);
        const longitude = parseFloat(match[2]);
        if (!isNaN(latitude) && !isNaN(longitude)) {
          return { latitude, longitude };
        }
      }
    } catch (error) {
      Logger.debug(`Failed to parse coordinates from URL: ${url}`);
    }
    return { latitude: null, longitude: null };
  }

  /**
   * Extracts the CID (Customer ID) from the Google ID hex string or URL.
   * Google ID format is 0x[hex1]:0x[hex2] where 0x[hex2] is the CID.
   * Example: 0x3be7ced84252e3cb:0xee16bb1cf9d9cc7d -> 0xee16bb1cf9d9cc7d -> 17156291696541584509 (Decimal)
   */
  public static parseCid(googleId: string, url: string): string | null {
    try {
      // 1. Try parsing from Google ID if it has the format 0x...:0x...
      if (googleId && googleId.includes(':')) {
        const parts = googleId.split(':');
        if (parts.length === 2 && parts[1].startsWith('0x')) {
          const hexCid = parts[1];
          // Convert hex to decimal string using BigInt
          const decimalCid = BigInt(hexCid).toString();
          if (decimalCid) {
            return decimalCid;
          }
        }
      }

      // 2. Try parsing from URL query parameters (e.g. ludocid=xxx, lrd=xxx, etc.)
      const urlObj = new URL(url);
      const ludocid = urlObj.searchParams.get('ludocid');
      if (ludocid) return ludocid;

      // 3. Fallback: search raw URL string for ludocid or cid patterns
      const ludocidMatch = url.match(/ludocid=([0-9]+)/);
      if (ludocidMatch) return ludocidMatch[1];

      const cidMatch = url.match(/cid=([0-9]+)/);
      if (cidMatch) return cidMatch[1];

    } catch (error) {
      Logger.debug(`Failed to parse CID for googleId: ${googleId}`);
    }
    return null;
  }
}
