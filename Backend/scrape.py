from typing import Dict, Any
import os
import json
import time
from scrapping_control2 import ScrapingController


async def async_scrape(url: str) -> Dict[str, Any]:
    scraper = ScrapingController()
    result = await scraper.scrape_website_async(url)

    # Ensure companyData directory exists
    output_dir = os.path.join(os.path.dirname(__file__), "companyData")
    os.makedirs(output_dir, exist_ok=True)

    # Create a safe filename from the URL
    safe_url = (
        url.replace("https://", "")
        .replace("http://", "")
        .replace("/", "_")
        .replace(":", "_")
    )
    filename = f"scrape_{safe_url[:50]}_{int(time.time())}.json"
    filepath = os.path.join(output_dir, filename)

    # Save result as JSON
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Scrape result saved to: {filepath}")

    return result
