import { BusinessData } from '../types';

// --- Helper Functions ---

const PROXY_URL = 'https://api.allorigins.win/raw?url=';
const EMAIL_REGEX = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/ig;
const NAME_TITLE_REGEX = /([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)+)[\s,·-]*\b(Owner|Founder|CEO|President|Principal|Director|Manager)\b/i;
const TITLE_KEYWORDS = ['About', 'Team', 'Contact', 'Leadership', 'Our Story'];
const NICHE_KEYWORDS = ['Roofer', 'Chiropractor', 'Plumber', 'Electrician', 'Massage', 'Therapist', 'Contractor', 'Landscaping', 'Cleaning', 'Consulting'];


/**
 * Fetches HTML content of a URL via a CORS proxy.
 */
async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(`${PROXY_URL}${encodeURIComponent(url)}`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    if (!response.ok) {
        console.error(`Failed to fetch ${url}: ${response.statusText}`);
        return null;
    }
    return await response.text();
  } catch (error) {
    console.error(`Error fetching page content for ${url}:`, error);
    return null;
  }
}

/**
 * Extracts all unique emails from a given text.
 */
function extractEmails(text: string): string[] {
    const emails = text.match(EMAIL_REGEX) || [];
    // Filter out common image/file emails and return unique emails
    return [...new Set(emails.filter(email => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email)))];
}

/**
 * Parses a name string into title, first, and last name.
 */
function parseName(fullName: string) {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
    return { firstName, lastName };
}


// --- Main Service Function ---

export const findOwnerInfo = async (business: BusinessData): Promise<{ 
    ownerTitle: string; 
    ownerFirstName: string; 
    ownerLastName: string; 
    ownerEmail: string; 
    niche: string; 
    uncertainty: string; 
} | null> => {
  const website = business.website || business.Website;

  if (!website || (!website.startsWith('http://') && !website.startsWith('https://'))) {
      console.warn('Skipping row due to missing or invalid website URL:', business);
      return { ownerTitle: '', ownerFirstName: '', ownerLastName: '', ownerEmail: '', niche: '', uncertainty: 'Invalid website URL' };
  }
  
  const htmlContent = await fetchPageContent(website);
  if (!htmlContent) {
    return { ownerTitle: '', ownerFirstName: '', ownerLastName: '', ownerEmail: '', niche: '', uncertainty: 'Failed to fetch website' };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const bodyText = doc.body.innerText || '';
  
  let ownerTitle = '';
  let ownerFirstName = '';
  let ownerLastName = '';
  let niche = '';
  
  // 1. Find Owner Name and Title
  const nameMatch = bodyText.match(NAME_TITLE_REGEX);
  if (nameMatch && nameMatch[1] && nameMatch[2]) {
      const { firstName, lastName } = parseName(nameMatch[1]);
      ownerFirstName = firstName;
      ownerLastName = lastName;
      ownerTitle = nameMatch[2];
  }
  
  // 2. Find Best Email
  const allEmails = extractEmails(htmlContent);
  const infoEmail = allEmails.find(e => /^(info|contact|hello|support|admin)/i.test(e));
  const ownerEmail = allEmails.length > 0 ? (infoEmail || allEmails[0]) : '';
  
  // 3. Find Niche
  const titleText = doc.title || '';
  for (const keyword of NICHE_KEYWORDS) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(titleText) || new RegExp(`\\b${keyword}\\b`, 'i').test(bodyText)) {
          niche = keyword;
          break;
      }
  }

  return {
    ownerTitle,
    ownerFirstName,
    ownerLastName,
    ownerEmail,
    niche,
    uncertainty: '', // Scraping is inherently uncertain, so we just return best effort.
  };
};
