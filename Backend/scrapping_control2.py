# Imports από τα υπάρχοντα modules
from source_code import get_website_source_code
from link_discovery import get_detailed_links_info
from clean_html import clean_html_for_content

# Standard library imports
import json
from typing import Dict, List, Optional, Any
import time
from bs4 import BeautifulSoup
import asyncio
from concurrent.futures import ThreadPoolExecutor


class ScrapingController:
    """
    Controller για unified web scraping που ενοποιεί source_code, link_discovery και clean_html
    """

    def __init__(self, timeout: int = 8, headless: bool = True):
        self.timeout = timeout
        self.headless = headless
        # παράλληλες εργασίες
        self.executor = ThreadPoolExecutor(max_workers=5)

    def scrape_website(self, url: str) -> Dict[str, Any]:
        """
        Scrape μία σελίδα και όλα τα discovered links της

        Returns:
            Dictionary με το JSON format που ορίσαμε
        """
        result = {
            "main_page": {},
            "discovered_links": [],
            "summary": {"total_links_found": 0, "successfully_scraped": 0, "failed": 0},
        }

        # 1. Scrape την κύρια σελίδα
        print(f"Scraping main page: {url}")
        main_page_data = self._scrape_single_page(url)
        result["main_page"] = main_page_data

        # 2. Discover links από την κύρια σελίδα
        if main_page_data.get("status") == "success":
            print("Discovering links...")

            raw_html = main_page_data.get("raw_html")
            links_info = get_detailed_links_info(
                html_content=raw_html, base_url=url, include_external=False
            )

            if links_info.get("success"):
                all_links = links_info.get("links", [])
                result["summary"]["total_links_found"] = len(all_links)

                links_to_scrape = all_links

                # 3. Scrape τα discovered links
                for link_url in links_to_scrape:
                    print(f"Scraping link: {link_url}")
                    link_data = self._scrape_single_page(link_url)
                    result["discovered_links"].append(link_data)

                    if link_data.get("status") == "success":
                        result["summary"]["successfully_scraped"] += 1
                    else:
                        result["summary"]["failed"] += 1

        return result

    async def scrape_website_async(self, url: str) -> Dict[str, Any]:
        result = {
            "main_page": {},
            "discovered_links": [],
            "summary": {"total_links_found": 0, "successfully_scraped": 0, "failed": 0},
        }

        # 1. Scrape την κύρια σελίδα
        print(f"Scraping main page: {url}")
        main_page_data = await self._scrape_single_page_async(url)
        result["main_page"] = main_page_data

        # 2. Discover links από την κύρια σελίδα
        if main_page_data.get("status") == "success":
            print("Discovering links...")

            # ✅ ΑΛΛΑΓΗ: Χρησιμοποίησε το HTML που ήδη έχεις
            raw_html = main_page_data.get("raw_html")
            links_info = get_detailed_links_info(
                html_content=raw_html, base_url=url, include_external=False
            )

            if links_info.get("success"):
                all_links = links_info.get("links", [])
                result["summary"]["total_links_found"] = len(all_links)

                links_to_scrape = all_links

                # 3. PARALLEL scraping των discovered links
                print(f"Starting parallel scraping of {len(links_to_scrape)} links...")
                tasks = [
                    self._scrape_single_page_async(link_url)
                    for link_url in links_to_scrape
                ]

                # Εκτέλεση όλων των tasks παράλληλα
                link_results = await asyncio.gather(*tasks, return_exceptions=True)

                # Επεξεργασία αποτελεσμάτων
                for link_data in link_results:
                    if isinstance(link_data, Exception):
                        # Handle exception
                        result["summary"]["failed"] += 1
                        continue

                    result["discovered_links"].append(link_data)

                    if link_data.get("status") == "success":
                        result["summary"]["successfully_scraped"] += 1
                    else:
                        result["summary"]["failed"] += 1

        return result

    def _scrape_single_page(self, url: str) -> Dict[str, Any]:
        """
        Scrape μία μονή σελίδα και επιστρέφει τα δεδομένα της

        Args:
            url: Το URL της σελίδας

        Returns:
            Dictionary με τα δεδομένα της σελίδας
        """
        page_data = {
            "url": url,
            "title": "",
            "clean_content": "",
            "status": "failed",
            "error": None,
        }

        # 1. Πάρε raw HTML από Bright Data
        try:
            raw_html = get_website_source_code(url, headless=self.headless)

            # ✅ ΠΡΟΣΘΗΚΗ: Κράτα το raw HTML για link discovery
            page_data["raw_html"] = raw_html

            if not raw_html:
                page_data["error"] = "Failed to fetch HTML"
                return page_data

            # 2. Καθάρισε το HTML
            clean_content = clean_html_for_content(raw_html)

            if clean_content:
                page_data["clean_content"] = clean_content.strip()
                page_data["status"] = "success"

                # Εξαγωγή title από το raw HTML
                try:
                    soup = BeautifulSoup(raw_html, "html.parser")
                    title_tag = soup.find("title")
                    if title_tag and title_tag.get_text():
                        page_data["title"] = title_tag.get_text().strip()
                except:
                    pass  # Αν δεν μπορούμε να πάρουμε title, συνεχίζουμε

                # Μετατροπή του clean_content σε απλό κείμενο (plain text)
                try:
                    soup_clean = BeautifulSoup(clean_content, "html.parser")
                    plain_text = soup_clean.get_text(separator="\n")
                    lines = [line.strip() for line in plain_text.splitlines()]
                    lines = [ln for ln in lines if ln]  # πέτα κενές γραμμές
                    plain_text = "\n".join(lines)
                    page_data["plain_text"] = plain_text
                    page_data["text_length"] = len(plain_text)
                    page_data["text_excerpt"] = plain_text[:500]
                except Exception:
                    page_data["plain_text"] = ""
                    page_data["text_length"] = 0
                    page_data["text_excerpt"] = ""

            else:
                page_data["error"] = "Failed to clean HTML"

        except Exception as e:
            page_data["error"] = str(e)

        return page_data

    # το scraping εκτελείται σε ξεχωριστό thread
    async def _scrape_single_page_async(self, url: str) -> Dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._scrape_single_page, url)

    def scrape_to_json(
        self, url: str, save_to_file: bool = False, filename: str = None
    ) -> str:
        """
        Scrape website και επιστρέφει JSON string

        Args:
            url: Το URL για scraping
            save_to_file: Αν True, αποθηκεύει σε αρχείο
            filename: Όνομα αρχείου (προαιρετικό)

        Returns:
            JSON string με τα αποτελέσματα
        """
        result = self.scrape_website(url)
        json_output = json.dumps(result, indent=2, ensure_ascii=False)

        if save_to_file:
            if not filename:
                filename = f"scraping_results_{int(time.time())}.json"

            with open(filename, "w", encoding="utf-8") as f:
                f.write(json_output)
            print(f"Results saved to: {filename}")

        return json_output

    def test_scraper(self, test_url: str = "https://example.com"):
        print(f"Testing ScrapingController with URL: {test_url}")
        print("=" * 50)

        try:
            start_time = time.time()
            result = self.scrape_website(test_url)
            end_time = time.time()

            print(f"Scraping completed in {end_time - start_time:.2f} seconds")
            print(f"Main page status: {result['main_page'].get('status', 'unknown')}")
            print(f"Total links found: {result['summary']['total_links_found']}")
            print(
                f"Successfully scraped links: {result['summary']['successfully_scraped']}"
            )
            print(f"Failed links: {result['summary']['failed']}")

            if result["main_page"].get("clean_content"):
                content_preview = result["main_page"]["clean_content"][:200]
                print(f"\nMain page content preview:\n{content_preview}...")

            return result

        except Exception as e:
            print(f"Test failed with error: {e}")
            return None
