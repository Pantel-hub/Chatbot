# source_code.py

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def get_website_source_code(url, headless=True):
    """
    Fetches the HTML source code of a website using requests.
    Free alternative to paid scraping services.

    Args:
        url: The URL of the page to scrape
        headless: Ignored (for compatibility)

    Returns:
        str: The HTML content of the page
    """
    # Configure session with retries
    session = requests.Session()
    retry = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    # Set headers to mimic a real browser
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    try:
        response = session.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        # Return the HTML content
        return response.text

    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Failed to fetch URL {url}: {str(e)}")
